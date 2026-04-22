package com.delivery.processor;

import com.delivery.model.EnrichedLocation;
import com.delivery.model.EnrichedWithDestination;
import com.delivery.model.RouteProgressState;
import com.delivery.util.RouteDistance;
import org.apache.kafka.streams.processor.api.Processor;
import org.apache.kafka.streams.processor.api.ProcessorContext;
import org.apache.kafka.streams.processor.api.ProcessorSupplier;
import org.apache.kafka.streams.processor.api.Record;
import org.apache.kafka.streams.state.KeyValueStore;

public class RouteProgressProcessor implements ProcessorSupplier<String, EnrichedWithDestination, String, EnrichedLocation> {
    public static final String STATE_STORE = "route-progress-store";

    @Override
    public Processor<String, EnrichedWithDestination, String, EnrichedLocation> get() {
        return new Processor<String, EnrichedWithDestination, String, EnrichedLocation>() {
            private ProcessorContext<String, EnrichedLocation> context;
            private KeyValueStore<String, RouteProgressState> stateStore;

            @Override
            public void init(ProcessorContext<String, EnrichedLocation> ctx) {
                this.context = ctx;
                this.stateStore = ctx.getStateStore(STATE_STORE);
            }

            @Override
            public void process(Record<String, EnrichedWithDestination> record) {
                EnrichedWithDestination value = record.value();
                if (value == null || value.getLocation() == null) {
                    return;
                }

                EnrichedLocation location = value.getLocation();
                if (value.getDestination() == null) {
                    context.forward(new Record<>(record.key(), location, record.timestamp()));
                    return;
                }

                RouteProgressState prev = stateStore.get(record.key());
                int minRouteIndex = prev != null ? prev.getLastRouteIndex() : 0;

                RouteDistance.Progress progress = RouteDistance.progressKm(
                        location.getLatitude(),
                        location.getLongitude(),
                        value.getDestination(),
                        minRouteIndex
                );

                RouteProgressState next = new RouteProgressState(
                        progress.getRouteIndex(),
                        progress.getDistanceTraveledKm(),
                        progress.getTotalDistanceKm()
                );
                stateStore.put(record.key(), next);

                int etaSec = 0;
                if (location.getSpeed() > 0) {
                    etaSec = (int) ((progress.getDistanceRemainingKm() / location.getSpeed()) * 3600);
                }

                location.withRouteProgress(
                        progress.getTotalDistanceKm(),
                        progress.getDistanceTraveledKm(),
                        progress.getDistanceRemainingKm(),
                        etaSec
                );

                context.forward(new Record<>(record.key(), location, record.timestamp()));
            }

            @Override
            public void close() {
                // No-op
            }
        };
    }
}
