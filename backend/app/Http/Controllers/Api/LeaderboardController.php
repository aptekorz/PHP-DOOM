<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLeaderboardEntryRequest;
use App\Http\Resources\LeaderboardEntryResource;
use App\Models\LeaderboardEntry;
use Illuminate\Http\JsonResponse;

class LeaderboardController extends Controller
{
    public function index(): JsonResponse
    {
        $entries = LeaderboardEntry::query()
            ->orderByDesc('score')
            ->orderBy('created_at')
            ->limit(25)
            ->get();

        return response()->json([
            'data' => LeaderboardEntryResource::collection($entries),
        ]);
    }

    public function store(StoreLeaderboardEntryRequest $request): JsonResponse
    {
        $entry = LeaderboardEntry::create($request->validated());

        return (new LeaderboardEntryResource($entry))
            ->response()
            ->setStatusCode(201);
    }
}
