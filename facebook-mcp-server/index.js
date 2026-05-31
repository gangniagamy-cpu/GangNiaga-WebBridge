#!/usr/bin/env node
/**
 * Facebook MCP Server
 *
 * Tools:
 *   facebook_get_pages          — List user's Facebook pages
 *   facebook_get_posts          — Get posts from a page
 *   facebook_get_post           — Get single post with comments
 *   facebook_post_to_page       — Publish post to a page
 *   facebook_get_messages       — Get messages from a conversation
 *   facebook_search             — Search Facebook (via browser scraping)
 *   facebook_scrape_profile     — Scrape public profile (via browser)
 *   facebook_scrape_page        — Scrape public page (via browser)
 *   facebook_get_notifications  — Get notifications (via browser)
 *   facebook_check_login        — Check login status (via browser)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs';
import path from 'node:path';

// Config
const CONFIG_PATH = path.join(
  process.env.USERPROFILE || '',
  'AppData',
  'Local',
  'hermes',
  'facebook-mcp-config.json',
);
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
// Load config (access token)
function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  return {
    access_token: null,
    page_token: null,
    user_id: null,
    note: 'Set access_token in ' + CONFIG_PATH,
  };
}

async function graphAPI(endpoint, params = {}) {
  const config = loadConfig();
  if (!config.access_token) {
    return { error: 'No access token. Run setup first.', setup_guide: getSetupGuide() };
  }

  const url = new URL(`${GRAPH_API_BASE}${endpoint}`);
  url.searchParams.set('access_token', config.access_token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url);
  return await res.json();
}

function getSetupGuide() {
  return `
Facebook MCP Server Setup:
1. Go to https://developers.facebook.com/tools/explorer/
2. Create an app or use Graph API Explorer
3. Generate a User Access Token with permissions:
   - pages_show_list
   - pages_read_engagement
   - pages_manage_posts
   - read_page_mailboxes (for messages)
4. For long-lived token: exchange it at
   https://developers.facebook.com/docs/facebook-login/access-tokens/refreshing/
5. Save to: ${CONFIG_PATH}
   Format: { "access_token": "YOUR_TOKEN", "page_token": "OPTIONAL_PAGE_TOKEN" }
`;
}

// Build MCP server
const server = new Server({ name: 'facebook', version: '1.0.0' }, { capabilities: { tools: {} } });

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'facebook_get_pages',
      description: 'List all Facebook pages the user manages.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'facebook_get_posts',
      description: 'Get posts from a Facebook page.',
      inputSchema: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'Facebook Page ID' },
          limit: { type: 'number', description: 'Number of posts (default 25)', default: 25 },
          since: { type: 'string', description: 'Since date (ISO 8601)', default: '' },
          until: { type: 'string', description: 'Until date (ISO 8601)', default: '' },
        },
        required: ['page_id'],
      },
    },
    {
      name: 'facebook_get_post',
      description: 'Get a single post with comments and reactions.',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: { type: 'string', description: 'Facebook Post ID' },
          include_comments: { type: 'boolean', description: 'Include comments', default: true },
          include_reactions: {
            type: 'boolean',
            description: 'Include reactions summary',
            default: true,
          },
        },
        required: ['post_id'],
      },
    },
    {
      name: 'facebook_post_to_page',
      description: 'Publish a new post to a Facebook page.',
      inputSchema: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'Facebook Page ID' },
          message: { type: 'string', description: 'Post text content' },
          link: { type: 'string', description: 'Optional URL to share' },
        },
        required: ['page_id', 'message'],
      },
    },
    {
      name: 'facebook_get_messages',
      description: 'Get messages from a Facebook page conversation.',
      inputSchema: {
        type: 'object',
        properties: {
          conversation_id: { type: 'string', description: 'Conversation ID' },
          limit: { type: 'number', description: 'Number of messages (default 25)', default: 25 },
        },
        required: ['conversation_id'],
      },
    },
    {
      name: 'facebook_search',
      description: 'Search Facebook via browser scraping (no token needed).',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          type: {
            type: 'string',
            description: 'Search type: all, pages, groups, posts',
            default: 'all',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'facebook_scrape_profile',
      description: 'Scrape public Facebook profile (no token needed, uses browser).',
      inputSchema: {
        type: 'object',
        properties: {
          profile_id: { type: 'string', description: "Profile ID or username (e.g. 'zuck')" },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to extract: name, bio, work, education, location, friends_count',
            default: ['name'],
          },
        },
        required: ['profile_id'],
      },
    },
    {
      name: 'facebook_scrape_page',
      description: 'Scrape public Facebook page (no token needed, uses browser).',
      inputSchema: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'Page ID or username' },
          extract_posts: {
            type: 'boolean',
            description: 'Also extract recent posts',
            default: false,
          },
          post_count: { type: 'number', description: 'Number of posts to extract', default: 5 },
        },
        required: ['page_id'],
      },
    },
    {
      name: 'facebook_get_notifications',
      description: 'Get Facebook notifications (requires browser with active session).',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of notifications', default: 20 },
        },
        required: [],
      },
    },
    {
      name: 'facebook_check_login',
      description: 'Check if Facebook is logged in via browser session.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    {
      name: 'facebook_setup',
      description: 'Interactive setup — shows instructions to configure Facebook access token.',
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
  ],
}));

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'facebook_setup': {
        return { content: [{ type: 'text', text: getSetupGuide() }] };
      }

      case 'facebook_get_pages': {
        const data = await graphAPI('/me/accounts', {
          fields: 'id,name,access_token,category,fan_count,picture',
        });
        if (data.error)
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            isError: true,
          };
        const pages = (data.data || []).map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          fans: p.fan_count,
          picture: p.picture?.data?.url || null,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(pages, null, 2) }] };
      }

      case 'facebook_get_posts': {
        const PAGE_ID = args.page_id;
        const LIMIT = args.limit || 25;
        const fields =
          'id,message,created_time,permalink_url,full_picture,shares,likes.summary(true),comments.summary(true)';
        const params = { fields, limit: LIMIT };
        if (args.since) params.since = args.since;
        if (args.until) params.until = args.until;

        const data = await graphAPI(`/${PAGE_ID}/posts`, params);
        if (data.error)
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            isError: true,
          };

        const posts = (data.data || []).map((p) => ({
          id: p.id,
          message: p.message || null,
          created_time: p.created_time,
          url: p.permalink_url,
          image: p.full_picture || null,
          shares: p.shares?.count || 0,
          likes: p.likes?.summary?.total_count || 0,
          comments: p.comments?.summary?.total_count || 0,
        }));
        return { content: [{ type: 'text', text: JSON.stringify(posts, null, 2) }] };
      }

      case 'facebook_get_post': {
        const POST_ID = args.post_id;
        const fields = [
          'id',
          'message',
          'created_time',
          'permalink_url',
          'full_picture',
          args.include_reactions ? 'reactions.summary(true)' : null,
          args.include_comments ? 'comments{from,message,created_time,like_count}' : null,
        ]
          .filter(Boolean)
          .join(',');

        const data = await graphAPI(`/${POST_ID}`, { fields });
        if (data.error)
          return {
            content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
            isError: true,
          };
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }

      case 'facebook_post_to_page': {
        const result = await graphAPI(`/${args.page_id}/feed`, {
          message: args.message,
          ...(args.link ? { link: args.link } : {}),
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'facebook_get_messages': {
        const result = await graphAPI(`/${args.conversation_id}/messages`, {
          fields: 'id,message,created_time,from',
          limit: args.limit || 25,
        });
        if (result.error)
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: true,
          };
        return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] };
      }

      case 'facebook_search': {
        // Use GangNiaga WebBridge for browser-based search
        const searchUrl = `https://www.facebook.com/search/${args.type || 'all'}/?q=${encodeURIComponent(args.query)}`;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  info: 'Facebook search requires browser scraping',
                  search_url: searchUrl,
                  query: args.query,
                  type: args.type || 'all',
                  note: 'Use GangNiaga WebBridge to navigate to this URL and scrape results',
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case 'facebook_scrape_profile':
      case 'facebook_scrape_page':
      case 'facebook_get_notifications':
      case 'facebook_check_login': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  info: 'This tool requires GangNiaga WebBridge + Chrome extension',
                  tool: args,
                  webbridge_status: 'Check /status endpoint',
                  extension_required: true,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

// Start
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Facebook MCP Server running on stdio');
}

main().catch(console.error);
