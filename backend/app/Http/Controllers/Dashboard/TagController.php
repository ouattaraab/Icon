<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Machine;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class TagController extends Controller
{
    public function index(): JsonResponse
    {
        $tags = Tag::withCount('machines')
            ->orderBy('name')
            ->get();

        return response()->json($tags);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:50|unique:tags,name',
            'color' => 'required|string|regex:/^#[0-9a-fA-F]{6}$/',
        ]);

        $tag = Tag::create($validated);

        AuditLog::log('tag.created', 'Tag', $tag->id, ['name' => $tag->name]);

        return response()->json($tag, 201);
    }

    public function update(Request $request, Tag $tag): JsonResponse
    {
        $validated = $request->validate([
            'name' => "required|string|max:50|unique:tags,name,{$tag->id}",
            'color' => 'required|string|regex:/^#[0-9a-fA-F]{6}$/',
        ]);

        $tag->update($validated);

        AuditLog::log('tag.updated', 'Tag', $tag->id, ['name' => $tag->name]);

        return response()->json($tag);
    }

    public function destroy(Tag $tag): JsonResponse
    {
        $name = $tag->name;
        $tag->delete();

        AuditLog::log('tag.deleted', 'Tag', null, ['name' => $name]);

        return response()->json(['ok' => true]);
    }

    public function assignToMachine(Request $request, Machine $machine): RedirectResponse
    {
        $validated = $request->validate([
            'tag_ids' => 'required|array',
            'tag_ids.*' => 'uuid|exists:tags,id',
        ]);

        $machine->tags()->sync($validated['tag_ids']);

        AuditLog::log('machine.tags_updated', 'Machine', $machine->id, [
            'hostname' => $machine->hostname,
            'tag_count' => count($validated['tag_ids']),
        ]);

        return redirect()->back()->with('success', 'Tags mis à jour.');
    }

    public function bulkAssign(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'machine_ids' => 'required|array|min:1',
            'machine_ids.*' => 'uuid|exists:machines,id',
            'tag_ids' => 'required|array',
            'tag_ids.*' => 'uuid|exists:tags,id',
        ]);

        $machines = Machine::whereIn('id', $validated['machine_ids'])->get();

        foreach ($machines as $machine) {
            $machine->tags()->syncWithoutDetaching($validated['tag_ids']);
        }

        $count = $machines->count();
        $tagCount = count($validated['tag_ids']);

        AuditLog::log('machine.bulk_tags_assigned', 'Machine', null, [
            'machine_count' => $count,
            'tag_count' => $tagCount,
        ]);

        return redirect()->back()->with('success', "{$tagCount} tag(s) assigné(s) à {$count} machine(s).");
    }
}
