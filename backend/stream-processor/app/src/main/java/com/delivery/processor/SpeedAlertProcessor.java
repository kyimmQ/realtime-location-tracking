package com.delivery.processor;

import com.delivery.model.EnrichedLocation;
import com.delivery.model.LocationEvent;
import com.delivery.util.Haversine;
import org.apache.kafka.streams.processor.api.Processor;
import org.apache.kafka.streams.processor.api.ProcessorContext;
import org.apache.kafka.streams.processor.api.ProcessorSupplier;
import org.apache.kafka.streams.processor.api.Record;
import org.apache.kafka.streams.state.KeyValueStore;

public class SpeedAlertProcessor implements ProcessorSupplier<String, LocationEvent, String, EnrichedLocation> {

    public static final String STATE_STORE = "previous-location";

    @Override
    public Processor<String, LocationEvent, String, EnrichedLocation> get() {
        return new Processor<String, LocationEvent, String, EnrichedLocation>() {
            private ProcessorContext<String, EnrichedLocation> context;
            private KeyValueStore<String, LocationEvent> stateStore;

            @Override
            public void init(ProcessorContext<String, EnrichedLocation> ctx) {
                this.context = ctx;
                this.stateStore = ctx.getStateStore(STATE_STORE);
            }

            @Override
            public void process(Record<String, LocationEvent> record) {
                LocationEvent curr = record.value();
                LocationEvent prev = stateStore.get(record.key());

                double speedKmh = 0.0;
                if (prev != null) {
                    double distKm = Haversine.haversine(
                            prev.getLatitude(), prev.getLongitude(),
                            curr.getLatitude(), curr.getLongitude()
                    );

                    double seconds = (curr.getTimestamp().getTime() - prev.getTimestamp().getTime()) / 1000.0;
                    if (seconds > 0) {
                        speedKmh = (distKm / seconds) * 3600;
                    }
                }

                EnrichedLocation enriched = new EnrichedLocation(curr, speedKmh);

                // Store current as previous for next iteration
                stateStore.put(record.key(), curr);

                context.forward(record.withValue(enriched));
            }

            @Override
            public void close() {
                // No-op
            }
        };
    }
}
