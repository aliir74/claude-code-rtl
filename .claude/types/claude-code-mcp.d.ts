// The inputs of the MCP tools this session had, from each server's tools/list
// inputSchema; written by `/plugin-types` (src/plugins/functionHooks/mcp-tool-types/mcp-tool-declarations.ts).
// Merges into the engine's ToolCallInput (types/ McpToolInputs) so
// `e.tool === "mcp__<server>__<tool>"` narrows to the tool's arguments.
// Regenerate rather than edit.
export {}
declare module 'claude-code' {
  interface McpToolInputs {
    /** Create a new question/card in Metabase. */
    mcp__metabase__create_card: {
      /** Name of the card. */
      name: string
      /** ID of the database to query. */
      database_id: number
      /** SQL query for the card. */
      query: string
      /** Optional description. */
      description?: string | null
      /** Optional collection to place the card in. */
      collection_id?: number | null
      /** Optional visualization configuration. */
      visualization_settings?: {} | null
    }
    /** Create a new collection in Metabase. */
    mcp__metabase__create_collection: {
      /** Name of the collection. */
      name: string
      /** Optional description. */
      description?: string | null
      /** Optional color for the collection. */
      color?: string | null
      /** Optional parent collection ID. */
      parent_id?: number | null
    }
    /** Execute a saved Metabase question/card and retrieve results. */
    mcp__metabase__execute_card: {
      /** The ID of the card to execute. */
      card_id: number
      /** Optional parameters for the card execution. */
      parameters?: {} | null
    }
    /** Execute a native SQL query against a Metabase database. */
    mcp__metabase__execute_query: {
      /** The ID of the database to query. */
      database_id: number
      /** The SQL query to execute. */
      query: string
      /** Optional parameters for the query. */
      native_parameters?: {}[] | null
    }
    /** Get all fields/columns in a specific table. */
    mcp__metabase__get_table_fields: {
      /** The ID of the table. */
      table_id: number
      /** Maximum number of fields to return (default: 20). */
      limit?: number
    }
    /** List all saved questions/cards in Metabase. Returns: Dictionary containing all cards with their metadata. */
    mcp__metabase__list_cards: {}
    /** List all collections in Metabase. Returns: Dictionary containing all collections with their metadata. */
    mcp__metabase__list_collections: {}
    /** List all databases configured in Metabase. Returns: A dictionary containing all available databases with their metadata. */
    mcp__metabase__list_databases: {}
    /** List all tables in a specific database. */
    mcp__metabase__list_tables: {
      /** The ID of the database to query. */
      database_id: number
    }
  }
}
