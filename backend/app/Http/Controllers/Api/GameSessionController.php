<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EndGameSessionRequest;
use App\Http\Requests\StartGameSessionRequest;
use App\Http\Resources\GameSessionResource;
use App\Models\GameSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class GameSessionController extends Controller
{
    public function start(StartGameSessionRequest $request): JsonResponse
    {
        $session = GameSession::create([
            'session_uuid' => (string) Str::uuid(),
            'nickname' => $request->validated('nickname'),
            'started_at' => now(),
            'user_agent' => Str::limit((string) $request->userAgent(), 512, ''),
            'ip_address' => $request->ip(),
        ]);

        return (new GameSessionResource($session))
            ->response()
            ->setStatusCode(201);
    }

    public function end(EndGameSessionRequest $request): GameSessionResource
    {
        $session = GameSession::where('session_uuid', $request->validated('session_uuid'))->firstOrFail();

        if ($session->ended_at === null) {
            $endedAt = now();

            $session->update([
                'ended_at' => $endedAt,
                'duration_seconds' => max(0, $session->started_at->diffInSeconds($endedAt)),
            ]);
        }

        return new GameSessionResource($session);
    }
}
