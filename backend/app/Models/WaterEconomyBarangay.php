<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WaterEconomyBarangay extends Model
{
    protected $fillable = [
        'psgc_code',
        'lgu',
        'barangay',
        'urban_rural',
        'population_2024',
        'avg_household_size',

        'gross_supply_m3_day',
        'allocable_water_m3_day',
        'source_capacity_m3_day',
        'nrw_rate_pct',
        'reserve_rate_pct',

        'tariff_php_m3',
        'monthly_consumption_m3',
        'proposed_tariff_php_m3',
        'demand_response_pct',

        'avg_household_income_php',
        'low_income_monthly_income_php',
        'affordability_low_threshold_pct',
        'affordability_high_threshold_pct',

        'household_demand_m3_day',
        'critical_services_demand_m3_day',
        'agriculture_demand_m3_day',
        'fisheries_demand_m3_day',
        'aquaculture_demand_m3_day',
        'business_demand_m3_day',
        'industry_demand_m3_day',

        'household_allocated_m3_day',
        'critical_services_allocated_m3_day',
        'agriculture_allocated_m3_day',
        'fisheries_allocated_m3_day',
        'aquaculture_allocated_m3_day',
        'business_allocated_m3_day',
        'industry_allocated_m3_day',

        'monthly_water_cost_php',
        'piped_access_pct',
        'supply_reliability_pct',
        'livelihood_profile',

        'sector_meta',
        'data_status',
        'data_version',
    ];

    protected $casts = [
        'sector_meta' => 'array',
        'data_status' => 'array',

        'population_2024' => 'integer',
        'data_version' => 'integer',

        'avg_household_size' => 'float',

        'gross_supply_m3_day' => 'float',
        'allocable_water_m3_day' => 'float',
        'source_capacity_m3_day' => 'float',
        'nrw_rate_pct' => 'float',
        'reserve_rate_pct' => 'float',

        'tariff_php_m3' => 'float',
        'monthly_consumption_m3' => 'float',
        'proposed_tariff_php_m3' => 'float',
        'demand_response_pct' => 'float',

        'avg_household_income_php' => 'float',
        'low_income_monthly_income_php' => 'float',
        'affordability_low_threshold_pct' => 'float',
        'affordability_high_threshold_pct' => 'float',

        'household_demand_m3_day' => 'float',
        'critical_services_demand_m3_day' => 'float',
        'agriculture_demand_m3_day' => 'float',
        'fisheries_demand_m3_day' => 'float',
        'aquaculture_demand_m3_day' => 'float',
        'business_demand_m3_day' => 'float',
        'industry_demand_m3_day' => 'float',

        'household_allocated_m3_day' => 'float',
        'critical_services_allocated_m3_day' => 'float',
        'agriculture_allocated_m3_day' => 'float',
        'fisheries_allocated_m3_day' => 'float',
        'aquaculture_allocated_m3_day' => 'float',
        'business_allocated_m3_day' => 'float',
        'industry_allocated_m3_day' => 'float',

        'monthly_water_cost_php' => 'float',
        'piped_access_pct' => 'float',
        'supply_reliability_pct' => 'float',
    ];
}
