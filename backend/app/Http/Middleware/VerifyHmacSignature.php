<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Symfony\Component\HttpFoundation\Response;

class VerifyHmacSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        // Skip HMAC verification if disabled in config
        if (! config('icon.security.verify_signatures', true)) {
            return $next($request);
        }

        // GET/HEAD/OPTIONS requests don't carry a body — only require API key auth
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'])) {
            return $next($request);
        }

        // ── Timestamp validation (replay-attack prevention) ────────────
        $timestamp = $request->header('X-Timestamp');

        if (! $timestamp) {
            return response()->json(['error' => 'Missing timestamp'], 401);
        }

        $timestampInt = (int) $timestamp;
        $maxAge = (int) config('icon.security.signature_max_age', 300);
        $diff = abs(time() - $timestampInt);

        if ($diff > $maxAge) {
            return response()->json(['error' => 'Request timestamp expired'], 401);
        }

        // ── Signature validation ───────────────────────────────────────
        $signature = $request->header('X-Signature');

        if (! $signature) {
            return response()->json(['error' => 'Missing HMAC signature'], 401);
        }

        $machine = $request->get('authenticated_machine');
        if (! $machine) {
            return response()->json(['error' => 'Machine not authenticated'], 401);
        }

        // Use per-machine HMAC secret (preferred) or fall back to global
        $hmacSecret = null;
        if ($machine->hmac_secret_encrypted) {
            try {
                $hmacSecret = Crypt::decryptString($machine->hmac_secret_encrypted);
            } catch (\Throwable) {
                return response()->json(['error' => 'HMAC secret corrupted'], 500);
            }
        } else {
            $hmacSecret = config('icon.security.hmac_secret');
        }

        if (! $hmacSecret) {
            return response()->json(['error' => 'HMAC not configured'], 500);
        }

        // Incorporate the timestamp into the signed payload to bind the
        // signature to a specific timestamp and prevent replay across windows.
        $signedPayload = $timestamp . '.' . $request->getContent();
        $expectedSignature = hash_hmac('sha256', $signedPayload, $hmacSecret);

        if (! hash_equals($expectedSignature, $signature)) {
            return response()->json(['error' => 'Invalid HMAC signature'], 401);
        }

        return $next($request);
    }
}
