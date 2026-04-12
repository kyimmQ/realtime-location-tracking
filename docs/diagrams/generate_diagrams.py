from diagrams import Cluster, Diagram, Edge
from diagrams.onprem.queue import Kafka
from diagrams.onprem.database import Cassandra
from diagrams.programming.language import Go, Java
from diagrams.programming.framework import React
from diagrams.generic.database import SQL

# Streamlined graph attributes for a data-pipeline view
graph_attr = {
    "fontsize": "20",
    "pad": "1.0",
    "splines": "ortho",
    "nodesep": "0.8",
    "ranksep": "1.0",
    "fontname": "Helvetica"
}

edge_attr = {
    "fontsize": "11",
    "fontname": "Helvetica",
    "color": "#444444"
}

with Diagram("Data Engineering Pipeline", show=False, direction="LR", graph_attr=graph_attr, filename="data_engineering_architecture"):

    # --- 1. INGESTION LAYER ---
    with Cluster("Ingestion Layer (Golang)"):
        simulator = Go("GPX Simulator\n& Data Validator")

    # --- 2. MESSAGING LAYER ---
    with Cluster("Event Bus (Apache Kafka)"):
        raw_topic = Kafka("Topic:\nraw-location-events")
        processed_topic = Kafka("Topic:\nprocessed-updates")
        alerts_topic = Kafka("Topic:\nalerts")

    # --- 3. STREAM PROCESSING LAYER ---
    with Cluster("Stream Processing (Java Kafka Streams)"):
        streams_app = Java("Topology:\nFilter → Speed/ETA → Branch")
        state_store = SQL("RocksDB\n(Stateful Store)")

    # --- 4. STORAGE LAYER ---
    with Cluster("Storage Layer (Apache Cassandra)"):
        trip_locs = Cassandra("trip_locations\n(Time-Series)")
        driver_analytics = Cassandra("driver_analytics\n(Weekly Aggregations)")
        alerts_table = Cassandra("alerts\n(Audit Trail)")

    # --- 5. SERVING & PRESENTATION ---
    with Cluster("Real-Time Serving"):
        ws_hub = Go("WebSocket Hub")
        ui = React("Customer & Driver UI")

    # ================================
    # DEFINING THE DATA FLOW
    # ================================

    # 1. Ingestion Phase
    simulator >> Edge(label="Publish Validated JSON", **edge_attr) >> raw_topic

    # 2. Processing Phase
    raw_topic >> Edge(label="Consume Raw", **edge_attr) >> streams_app
    streams_app >> Edge(label="Lookup Previous GPS", **{**edge_attr, "style": "dashed"}) << state_store
    
    # 3. Branching Output Phase
    streams_app >> Edge(label="Valid Locations", **{**edge_attr, "color": "green", "style": "bold"}) >> processed_topic
    streams_app >> Edge(label="Violations (Speed > 60km/h,\nProx < 500m)", **{**edge_attr, "color": "red", "style": "bold"}) >> alerts_topic

    # 4. Storage Persistence Phase
    processed_topic >> Edge(label="Async Write", **{**edge_attr, "color": "purple"}) >> trip_locs
    alerts_topic >> Edge(label="Async Write", **{**edge_attr, "color": "purple"}) >> alerts_table
    trip_locs >> Edge(label="Batch Rollup", **{**edge_attr, "style": "dotted"}) >> driver_analytics

    # 5. Real-Time Push Phase
    processed_topic >> Edge(label="Consume Feed", **{**edge_attr, "color": "blue"}) >> ws_hub
    alerts_topic >> Edge(label="Consume Alerts", **{**edge_attr, "color": "blue"}) >> ws_hub
    ws_hub >> Edge(label="WSS Push", **{**edge_attr, "style": "dashed", "color": "green"}) >> ui