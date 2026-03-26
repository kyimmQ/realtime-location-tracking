package com.delivery.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public class SpeedAccumulator {
    @JsonProperty("sum")
    private double sum;

    @JsonProperty("count")
    private int count;

    public SpeedAccumulator() {
        this.sum = 0.0;
        this.count = 0;
    }

    public SpeedAccumulator add(double speed) {
        this.sum += speed;
        this.count++;
        return this;
    }

    public double getAverage() {
        return this.count == 0 ? 0.0 : this.sum / this.count;
    }

    public double getSum() { return sum; }
    public void setSum(double sum) { this.sum = sum; }

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }
}