<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyHmacSignature
{
    public function handle(Request $request, Closure $next): Response
    {
        $signature = $request->header('X-Signature');

        if (!$signature) {
            return response()->json(['error' => 'Missing HMAC signature'], 401);
        }

        $machine = $request->get('authenticated_machine');
        if (!$machine) {
            return response()->json(['error' => 'Machine not authenticated'], 401);
        }

        $hmacSecret = config('icon.hmac_secret');
        $expectedSignature = hash_hmac('sha256', $request->getContent(), $hmacSecret);

        if (!hash_equals($expectedSignature, $signature)) {
            return response()->json(['error' => 'Invalid HMAC signature'], 401);
        }

        return $next($request);
    }
}
