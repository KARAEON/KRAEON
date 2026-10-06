<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WaterEconomyProject extends Model
{
    protected $fillable = [
        'psgc_code',
        'project_type',
        'name',
        'capex_php',
        'annual_opex_php',
        'useful_life_years',
        'water_gain_m3_per_day',
        'households_benefited',
        'reliability_score',
        'equity_score',
        'economic_benefit_score',
        'implementation_time_months',
    ];

    protected $casts = [
        'capex_php' => 'float',
        'annual_opex_php' => 'float',
        'useful_life_years' => 'integer',
        'water_gain_m3_per_day' => 'float',
        'households_benefited' => 'integer',
        'reliability_score' => 'float',
        'equity_score' => 'float',
        'economic_benefit_score' => 'float',
        'implementation_time_months' => 'integer',
    ];
}
