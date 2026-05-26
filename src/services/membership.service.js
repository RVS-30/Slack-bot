import {
  upsertUserChannels,
  getAccessibleChannels,
  isMembershipStale,
} from "../repositories/message.repository.js";

const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

// Sync user's channel memberships from Slack API
async function syncUserChannels(client, workspaceId, userId) {
  console.log(`${CYAN}🔒 Syncing channel membership — user: ${userId}${RESET}`);

  let channels = [];
  let cursor;

  // Paginate through all channels the user is a member of
  do {
    const res = await client.users.conversations({
      user: userId,
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
      ...(cursor && { cursor }),
    });

    const batch = (res.channels || []).map((c) => ({
      channel_id: c.id,
      is_private: c.is_private || false,
    }));

    channels = channels.concat(batch);
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  console.log(`${YELLOW}   ↳ Channels found: ${channels.length}${RESET}`);

  if (channels.length > 0) {
    await upsertUserChannels(workspaceId, userId, channels);
  }

  return channels.map((c) => c.channel_id);
}

// Main entry point — sync if stale, then return accessible channel IDs
export async function resolveAccessibleChannels(client, workspaceId, userId) {
  const stale = await isMembershipStale(workspaceId, userId);

  if (stale) {
    return await syncUserChannels(client, workspaceId, userId);
  }

  const channels = await getAccessibleChannels(workspaceId, userId);
  console.log(`${CYAN}🔒 Membership cache hit — ${channels.length} channels${RESET}`);
  return channels;
}