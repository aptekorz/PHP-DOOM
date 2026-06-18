<?php

use App\Http\Controllers\Api\GameSessionController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\LeaderboardController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::post('/game-session/start', [GameSessionController::class, 'start']);
Route::post('/game-session/end', [GameSessionController::class, 'end']);

Route::get('/leaderboard', [LeaderboardController::class, 'index']);
Route::post('/leaderboard', [LeaderboardController::class, 'store']);
