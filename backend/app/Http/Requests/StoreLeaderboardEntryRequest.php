<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreLeaderboardEntryRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'nickname' => ['required', 'string', 'min:1', 'max:40'],
            'score' => ['required', 'integer', 'min:0', 'max:999999999'],
            'level' => ['nullable', 'string', 'max:80'],
            'duration_seconds' => ['nullable', 'integer', 'min:0', 'max:31536000'],
        ];
    }
}
