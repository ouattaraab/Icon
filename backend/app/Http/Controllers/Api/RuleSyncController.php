<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Rule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class RuleSyncController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $sinceVersion = (int) $request->query('version', 0);

        // Get rules newer than the requested version
        $rules = Rule::where('version', '>', $sinceVersion)
            ->where('enabled', true)
            ->orderBy('priority', 'desc')
            ->get()
            ->map(fn (Rule $rule) => $rule->toAgentFormat());

        // Get IDs of rules that were deleted since the agent's last sync
        // We track deletions in a Redis set
        $deletedIds = Cache::get('icon:deleted_rules', []);
        $deletedIds = array_values(array_filter($deletedIds, function ($entry) use ($sinceVersion) {
            return ($entry['deleted_at_version'] ?? 0) > $sinceVersion;
        }));
        $deletedRuleIds = array_column($deletedIds, 'rule_id');

        return response()->json([
            'rules' => $rules,
            'deleted_ids' => $deletedRuleIds,
        ]);
    }
}
