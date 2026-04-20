#!/bin/bash

echo "Starting infrastructure..."
docker compose up -d

echo "Waiting for Cassandra to start (this might take a while)..."
# Wait until Cassandra is ready to accept connections
until docker exec cassandra cqlsh -e "describe keyspaces" > /dev/null 2>&1; do
  echo "Cassandra is unavailable - sleeping"
  sleep 5
done

echo "Cassandra is up. Initializing schema..."
docker exec -i cassandra cqlsh < scripts/init-cql.cql

echo "Waiting for Postgres to start..."
# Wait until Postgres is ready
until docker exec postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo "Postgres is unavailable - sleeping"
  sleep 2
done

echo "Postgres is up. Initializing schema and data..."
docker exec -i postgres psql -U postgres -d delivery_tracking < scripts/init-postgres.sql
docker exec -i postgres psql -U postgres -d delivery_tracking < scripts/seed-postgres.sql

echo "Waiting for Kafka to be ready..."
# Wait until Kafka is ready
until docker exec kafka kafka-topics --list --bootstrap-server localhost:9092 > /dev/null 2>&1; do
  echo "Kafka is unavailable - sleeping"
  sleep 5
done

echo "Kafka is up. Creating topics..."

docker exec kafka kafka-topics \
  --create --topic raw-location-events \
  --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 --if-not-exists

docker exec kafka kafka-topics \
  --create --topic processed-updates \
  --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 --if-not-exists

docker exec kafka kafka-topics \
  --create --topic alerts \
  --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 --if-not-exists

docker exec kafka kafka-topics \
  --create --topic orders \
  --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1 --if-not-exists


echo "Infrastructure setup complete!"
