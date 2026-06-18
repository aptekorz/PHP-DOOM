<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaderboardEntryResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nickname' => $this->nickname,
            'score' => $this->score,
            'level' => $this->level,
            'duration_seconds' => $this->duration_seconds,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
