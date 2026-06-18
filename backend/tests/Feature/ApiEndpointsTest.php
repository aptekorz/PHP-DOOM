<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_returns_json(): void
    {
        $response = $this->getJson('/api/health');

        $response->assertStatus(200);
        $response->assertJsonPath('status', 'ok');
    }

    public function test_game_session_can_start_and_end(): void
    {
        $start = $this->postJson('/api/game-session/start', [
            'nickname' => 'Doomguy',
        ]);

        $start->assertCreated()
            ->assertJsonPath('data.nickname', 'Doomguy')
            ->assertJsonStructure(['data' => ['session_uuid', 'started_at']]);

        $sessionUuid = $start->json('data.session_uuid');

        $end = $this->postJson('/api/game-session/end', [
            'session_uuid' => $sessionUuid,
        ]);

        $end->assertOk()
            ->assertJsonPath('data.session_uuid', $sessionUuid)
            ->assertJsonStructure(['data' => ['ended_at', 'duration_seconds']]);
    }

    public function test_leaderboard_can_store_and_list_entries(): void
    {
        $store = $this->postJson('/api/leaderboard', [
            'nickname' => 'Marine',
            'score' => 12345,
            'level' => 'E1M1',
            'duration_seconds' => 300,
        ]);

        $store->assertCreated()
            ->assertJsonPath('data.nickname', 'Marine')
            ->assertJsonPath('data.score', 12345);

        $list = $this->getJson('/api/leaderboard');

        $list->assertOk()
            ->assertJsonFragment([
                'nickname' => 'Marine',
                'score' => 12345,
            ]);
    }

    public function test_validation_errors_are_json(): void
    {
        $response = $this->postJson('/api/leaderboard', [
            'nickname' => '',
            'score' => -1,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['nickname', 'score']);
    }
}
