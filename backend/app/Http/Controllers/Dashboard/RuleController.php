<?php

namespace App\Http\Controllers\Dashboard;

use App\Events\RuleDeleted;
use App\Events\RuleUpdated;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Rule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RuleController extends Controller
{
    public function index(): Response
    {
        $rules = Rule::orderBy('priority', 'desc')
            ->orderBy('name')
            ->paginate(25);

        return Inertia::render('Rules/Index', [
            'rules' => $rules,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Rules/Create');
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category' => 'required|in:block,alert,log',
            'target' => 'required|in:prompt,response,clipboard,domain',
            'condition_type' => 'required|in:regex,keyword,domain_list,content_length',
            'condition_value' => 'required|array',
            'action_config' => 'nullable|array',
            'priority' => 'required|integer|min:0|max:1000',
            'enabled' => 'boolean',
        ]);

        $validated['created_by'] = auth()->id();

        $rule = Rule::create($validated);

        broadcast(new RuleUpdated($rule, 'created'))->toOthers();

        AuditLog::log('rule.created', 'Rule', $rule->id, [
            'name' => $rule->name,
            'category' => $rule->category,
        ]);

        return redirect()->route('rules.index')
            ->with('success', "Règle « {$rule->name} » créée.");
    }

    public function edit(Rule $rule): Response
    {
        return Inertia::render('Rules/Edit', [
            'rule' => $rule,
        ]);
    }

    public function update(Request $request, Rule $rule): RedirectResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category' => 'required|in:block,alert,log',
            'target' => 'required|in:prompt,response,clipboard,domain',
            'condition_type' => 'required|in:regex,keyword,domain_list,content_length',
            'condition_value' => 'required|array',
            'action_config' => 'nullable|array',
            'priority' => 'required|integer|min:0|max:1000',
            'enabled' => 'boolean',
        ]);

        $rule->update($validated);

        broadcast(new RuleUpdated($rule, 'updated'))->toOthers();

        AuditLog::log('rule.updated', 'Rule', $rule->id, [
            'name' => $rule->name,
            'changes' => $rule->getChanges(),
        ]);

        return redirect()->route('rules.index')
            ->with('success', "Règle « {$rule->name} » mise à jour.");
    }

    public function destroy(Rule $rule): RedirectResponse
    {
        $name = $rule->name;
        $ruleId = $rule->id;

        // Track deletion for agent sync
        $deletedRules = Cache::get('icon:deleted_rules', []);
        $deletedRules[] = [
            'rule_id' => $ruleId,
            'deleted_at_version' => $rule->version,
        ];
        Cache::put('icon:deleted_rules', $deletedRules, now()->addDays(30));

        $rule->delete();

        broadcast(new RuleDeleted($ruleId, $name));

        AuditLog::log('rule.deleted', 'Rule', $ruleId, ['name' => $name]);

        return redirect()->route('rules.index')
            ->with('success', "Règle « {$name} » supprimée.");
    }

    public function toggleEnabled(Rule $rule): RedirectResponse
    {
        $rule->update(['enabled' => ! $rule->enabled]);

        broadcast(new RuleUpdated($rule, 'toggled'))->toOthers();

        AuditLog::log(
            $rule->enabled ? 'rule.enabled' : 'rule.disabled',
            'Rule',
            $rule->id
        );

        return back();
    }

    /**
     * Export all rules as a JSON download.
     */
    public function export(): JsonResponse
    {
        $rules = Rule::orderBy('priority', 'desc')->get()->map(fn (Rule $rule) => [
            'name' => $rule->name,
            'description' => $rule->description,
            'category' => $rule->category,
            'target' => $rule->target,
            'condition_type' => $rule->condition_type,
            'condition_value' => $rule->condition_value,
            'action_config' => $rule->action_config,
            'priority' => $rule->priority,
            'enabled' => $rule->enabled,
        ]);

        AuditLog::log('rules.exported', 'Rule', null, ['count' => $rules->count()]);

        return response()->json([
            'version' => '1.0',
            'exported_at' => now()->toIso8601String(),
            'count' => $rules->count(),
            'rules' => $rules,
        ], 200, [
            'Content-Disposition' => 'attachment; filename="icon-rules-' . now()->format('Y-m-d') . '.json"',
        ]);
    }

    /**
     * Import rules from a JSON file upload.
     */
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:json,txt|max:2048',
        ]);

        $content = file_get_contents($request->file('file')->getRealPath());
        $data = json_decode($content, true);

        if (! $data || ! isset($data['rules']) || ! is_array($data['rules'])) {
            return back()->with('error', 'Format de fichier invalide. Le fichier doit contenir une clé "rules".');
        }

        $validCategories = ['block', 'alert', 'log'];
        $validTargets = ['prompt', 'response', 'clipboard', 'domain'];
        $validConditionTypes = ['regex', 'keyword', 'domain_list', 'content_length'];

        $imported = 0;
        $skipped = 0;
        $errors = [];

        DB::beginTransaction();

        try {
            foreach ($data['rules'] as $i => $ruleData) {
                // Validate required fields
                if (empty($ruleData['name']) || empty($ruleData['category']) || empty($ruleData['target'])
                    || empty($ruleData['condition_type']) || ! isset($ruleData['condition_value'])) {
                    $errors[] = "Règle #{$i}: champs requis manquants.";
                    $skipped++;

                    continue;
                }

                if (! in_array($ruleData['category'], $validCategories)
                    || ! in_array($ruleData['target'], $validTargets)
                    || ! in_array($ruleData['condition_type'], $validConditionTypes)) {
                    $errors[] = "Règle #{$i} ({$ruleData['name']}): valeur de catégorie, cible ou type invalide.";
                    $skipped++;

                    continue;
                }

                Rule::create([
                    'name' => $ruleData['name'],
                    'description' => $ruleData['description'] ?? null,
                    'category' => $ruleData['category'],
                    'target' => $ruleData['target'],
                    'condition_type' => $ruleData['condition_type'],
                    'condition_value' => is_array($ruleData['condition_value']) ? $ruleData['condition_value'] : json_decode($ruleData['condition_value'], true),
                    'action_config' => isset($ruleData['action_config']) && is_array($ruleData['action_config']) ? $ruleData['action_config'] : null,
                    'priority' => (int) ($ruleData['priority'] ?? 0),
                    'enabled' => (bool) ($ruleData['enabled'] ?? true),
                    'created_by' => auth()->id(),
                ]);

                $imported++;
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            return back()->with('error', "Erreur lors de l'import : {$e->getMessage()}");
        }

        AuditLog::log('rules.imported', 'Rule', null, [
            'imported' => $imported,
            'skipped' => $skipped,
        ]);

        $message = "{$imported} règle(s) importée(s).";
        if ($skipped > 0) {
            $message .= " {$skipped} ignorée(s).";
        }

        return redirect()->route('rules.index')->with('success', $message);
    }
}
