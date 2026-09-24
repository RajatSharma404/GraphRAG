"""
Neo4j Graph Database Client
Handles connection pooling, query execution, and session management.
"""

from typing import Any, Dict, List, Optional
from neo4j import GraphDatabase, Driver
from config.settings import settings
import logging

logger = logging.getLogger("graphrag.neo4j")

class Neo4jClient:
    def __init__(self, uri: Optional[str] = None, user: Optional[str] = None, password: Optional[str] = None):
        self.uri = uri or settings.neo4j_uri
        self.user = user or settings.neo4j_user
        self.password = password or settings.neo4j_password
        self._driver: Optional[Driver] = None

    def connect(self) -> Driver:
        """Establishes driver connection pool if not already active."""
        if not self._driver:
            self._driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password),
                max_connection_lifetime=3600
            )
        return self._driver

    def verify_connectivity(self) -> bool:
        """Verifies active connectivity to Neo4j instance."""
        try:
            driver = self.connect()
            driver.verify_connectivity()
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j at {self.uri}: {e}")
            return False

    def execute_query(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Executes a Cypher query within an auto-commit or managed transaction."""
        driver = self.connect()
        with driver.session() as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def clear_database(self) -> None:
        """Caution: Deletes all nodes and relationships in the graph."""
        query = "MATCH (n) DETACH DELETE n"
        self.execute_query(query)
        logger.warning("All nodes and relationships purged from Neo4j.")

    def close(self) -> None:
        """Closes the connection pool."""
        if self._driver:
            self._driver.close()
            self._driver = None

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
