<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaderboardEntry extends Model
{
    protected $fillable = [
        'nickname',
        'score',
        'level',
        'duration_seconds',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'integer',
            'duration_seconds' => 'integer',
        ];
    }
}
