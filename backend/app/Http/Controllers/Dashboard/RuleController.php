<?php

namespace App\Http\Controllers\Dashboard;

use App\Events\RuleDeleted;
use App\Events\RuleUpdated;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Rule;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
        $rule->update(['enabled' => !$rule->enabled]);

        broadcast(new RuleUpdated($rule, 'toggled'))->toOthers();

        AuditLog::log(
            $rule->enabled ? 'rule.enabled' : 'rule.disabled',
            'Rule',
            $rule->id
        );

        return back();
    }
}
