package com.delivery.model;

public class EnrichedWithDestination {
    private EnrichedLocation location;
    private Destination destination;

    public EnrichedWithDestination() {}

    public EnrichedWithDestination(EnrichedLocation location, Destination destination) {
        this.location = location;
        this.destination = destination;
    }

    public EnrichedLocation getLocation() {
        return location;
    }

    public void setLocation(EnrichedLocation location) {
        this.location = location;
    }

    public Destination getDestination() {
        return destination;
    }

    public void setDestination(Destination destination) {
        this.destination = destination;
    }
}
