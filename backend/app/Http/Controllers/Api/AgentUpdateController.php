<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentUpdateController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'current_version' => 'required|string|max:50',
            'os' => 'nullable|string|in:windows,macos',
        ]);

        $latestVersion = Setting::getValue('agent_current_version', '0.1.0');
        $currentVersion = $request->input('current_version');

        // No update needed
        if (version_compare($currentVersion, $latestVersion, '>=')) {
            return response()->json(['update_available' => false]);
        }

        $updateUrl = Setting::getValue('agent_update_url', '');
        $verifySignatures = Setting::getValue('verify_signatures', '1') === '1';

        return response()->json([
            'update_available' => true,
            'version' => $latestVersion,
            'download_url' => $updateUrl ?: null,
            'verify_signature' => $verifySignatures,
            'changelog' => "Mise à jour vers {$latestVersion}",
        ]);
    }
}
