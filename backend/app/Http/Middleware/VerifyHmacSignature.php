<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyHmacSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        // Skip HMAC verification if disabled in config
        if (!config('icon.security.verify_signatures', true)) {
            return $next($request);
        }

        // GET/HEAD/OPTIONS requests don't carry a body — only require API key auth
        if (in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'])) {
            return $next($request);
        }

        $signature = $request->header('X-Signature');

        if (!$signature) {
            return response()->json(['error' => 'Missing HMAC signature'], 401);
        }

        $machine = $request->get('authenticated_machine');
        if (!$machine) {
            return response()->json(['error' => 'Machine not authenticated'], 401);
        }

        $hmacSecret = config('icon.security.hmac_secret');
        $expectedSignature = hash_hmac('sha256', $request->getContent(), $hmacSecret);

        if (!hash_equals($expectedSignature, $signature)) {
            return response()->json(['error' => 'Invalid HMAC signature'], 401);
        }

        return $next($request);
    }
}
