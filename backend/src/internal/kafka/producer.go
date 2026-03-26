package kafka

import (
    "context"
    "encoding/json"
    "time"

    "github.com/segmentio/kafka-go"
)

type Producer struct {
    writer *kafka.Writer
}

func NewProducer(brokers string) (*Producer, error) {
    writer := &kafka.Writer{
        Addr:         kafka.TCP(brokers),
        Topic:        "raw-location-events",
        Balancer:     &kafka.LeastBytes{},
        BatchTimeout: 10 * time.Millisecond,
    }
    return &Producer{writer: writer}, nil
}

func (p *Producer) Publish(ctx context.Context, event interface{}) error {
    data, err := json.Marshal(event)
    if err != nil {
        return err
    }
    return p.writer.WriteMessages(ctx, kafka.Message{Value: data})
}

func (p *Producer) Close() error {
    return p.writer.Close()
}
