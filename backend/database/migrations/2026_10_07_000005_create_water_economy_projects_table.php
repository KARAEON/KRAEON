<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('water_economy_projects', function (Blueprint $table) {
            $table->id();

            $table->string('psgc_code', 20)->index();

            $table->string('project_type', 80);
            $table->string('name', 160);

            $table->decimal('capex_php', 16, 2)->default(0);
            $table->decimal('annual_opex_php', 16, 2)->default(0);

            $table->unsignedInteger('useful_life_years')->default(1);

            $table->decimal('water_gain_m3_per_day', 14, 2)->default(0);

            $table->unsignedInteger('households_benefited')->default(0);

            $table->decimal('reliability_score', 5, 2)->default(0);
            $table->decimal('equity_score', 5, 2)->default(0);
            $table->decimal('economic_benefit_score', 5, 2)->default(0);

            $table->unsignedInteger('implementation_time_months')->default(1);

            $table->timestamps();

            $table->foreign('psgc_code')
                ->references('psgc_code')
                ->on('water_economy_barangays')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('water_economy_projects');
    }
};
