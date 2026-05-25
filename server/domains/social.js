function registerSocialRoutes(app, {
  areFriends,
  createFriendship,
  db,
  friendshipPair,
  inTransaction,
  normalizeUsername,
  publicFriendUser,
  publicUser,
  requireApiUser,
  roomHasUser,
  presenceForUser,
}) {
  app.post("/api/presence", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;
    res.json({ presence: presenceForUser(user.id) });
  });

  app.patch("/api/me", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const username = normalizeUsername(req.body?.username);
    if (username.length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters" });
      return;
    }

    const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, user.id);
    if (existing) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }

    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, user.id);
    res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) });
  });

  app.get("/api/friends/user/:username", (req, res) => {
    const username = normalizeUsername(req.params.username);
    if (!username) {
      res.status(400).json({ error: "Invalid friend link" });
      return;
    }

    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) {
      res.status(404).json({ error: "Invalid friend link" });
      return;
    }

    res.json({ user: publicUser(user) });
  });

  app.post("/api/friends/user/:username", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const username = normalizeUsername(req.params.username);
    if (!username) {
      res.status(400).json({ error: "Invalid friend link" });
      return;
    }

    const target = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!target) {
      res.status(404).json({ error: "Invalid friend link" });
      return;
    }
    if (target.id === user.id) {
      res.status(400).json({ error: "This is your own friend link" });
      return;
    }

    const alreadyFriends = areFriends(user.id, target.id);
    inTransaction(() => {
      createFriendship(user.id, target.id);
      db.prepare(`
        UPDATE friend_requests
        SET status = 'accepted', responded_at = ?
        WHERE status = 'pending'
          AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
      `).run(Date.now(), user.id, target.id, target.id, user.id);
    });

    res.json({
      message: alreadyFriends
        ? `You are already friends with ${target.username || target.name || "that player"}`
        : `You are now friends with ${target.username || target.name || "that player"}`,
      friend: publicUser(target),
    });
  });

  app.get("/api/friends", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const friends = db.prepare(`
      SELECT u.id, u.username, u.name, u.email, u.picture, f.created_at
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
      WHERE f.user_id = ? OR f.friend_id = ?
      ORDER BY LOWER(u.username)
    `).all(user.id, user.id, user.id).map(publicFriendUser);

    res.json({ friends });
  });

  app.get("/api/friends/requests", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const incoming = db.prepare(`
      SELECT fr.id, fr.created_at, u.id AS user_id, u.username, u.name, u.email, u.picture
      FROM friend_requests fr
      JOIN users u ON u.id = fr.requester_id
      WHERE fr.addressee_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `).all(user.id);

    const outgoing = db.prepare(`
      SELECT fr.id, fr.created_at, u.id AS user_id, u.username, u.name, u.email, u.picture
      FROM friend_requests fr
      JOIN users u ON u.id = fr.addressee_id
      WHERE fr.requester_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `).all(user.id);

    res.json({ incoming, outgoing });
  });

  app.get("/api/friends/search", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const query = String(req.query.q || "").trim().toLowerCase();
    if (!query) {
      res.json({ users: [] });
      return;
    }

    const users = db.prepare(`
      SELECT u.id, u.username, u.name, u.email, u.picture,
        CASE
          WHEN f.user_id IS NOT NULL THEN 'friend'
          WHEN outgoing.id IS NOT NULL THEN 'outgoing_pending'
          WHEN incoming.id IS NOT NULL THEN 'incoming_pending'
          ELSE 'none'
        END AS friendship_status
      FROM users u
      LEFT JOIN friendships f
        ON ((f.user_id = ? AND f.friend_id = u.id) OR (f.user_id = u.id AND f.friend_id = ?))
      LEFT JOIN friend_requests outgoing
        ON outgoing.requester_id = ? AND outgoing.addressee_id = u.id AND outgoing.status = 'pending'
      LEFT JOIN friend_requests incoming
        ON incoming.requester_id = u.id AND incoming.addressee_id = ? AND incoming.status = 'pending'
      WHERE u.id != ?
        AND LOWER(u.username) LIKE ?
      ORDER BY LOWER(u.username)
      LIMIT 20
    `).all(user.id, user.id, user.id, user.id, user.id, `%${query}%`).map(publicFriendUser);

    res.json({ users });
  });

  app.post("/api/friends/requests", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const targetUserId = String(req.body?.userId || req.body?.user_id || "");
    if (!targetUserId) {
      res.status(400).json({ error: "Invalid user" });
      return;
    }
    if (targetUserId === user.id) {
      res.status(400).json({ error: "You cannot add yourself" });
      return;
    }

    const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetUserId);
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [firstId, secondId] = friendshipPair(user.id, targetUserId);
    const existingFriendship = db.prepare(`
      SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?
    `).get(firstId, secondId);
    if (existingFriendship) {
      res.status(400).json({ error: "You are already friends" });
      return;
    }

    const incoming = db.prepare(`
      SELECT id FROM friend_requests
      WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
    `).get(targetUserId, user.id);
    if (incoming) {
      res.status(409).json({ error: `${target.name || target.email} already sent you a request` });
      return;
    }

    db.prepare(`
      INSERT INTO friend_requests (requester_id, addressee_id, status, created_at, responded_at)
      VALUES (?, ?, 'pending', ?, NULL)
      ON CONFLICT(requester_id, addressee_id) DO UPDATE SET
        status = 'pending',
        created_at = excluded.created_at,
        responded_at = NULL
      WHERE friend_requests.status != 'pending'
    `).run(user.id, targetUserId, Date.now());

    res.json({ message: `Friend request sent to ${target.name || target.email}` });
  });

  app.post("/api/friends/requests/:id/accept", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId)) {
      res.status(400).json({ error: "Invalid friend request" });
      return;
    }

    const request = db.prepare(`
      SELECT fr.id, fr.requester_id, u.name, u.email
      FROM friend_requests fr
      JOIN users u ON u.id = fr.requester_id
      WHERE fr.id = ? AND fr.addressee_id = ? AND fr.status = 'pending'
    `).get(requestId, user.id);
    if (!request) {
      res.status(404).json({ error: "Friend request not found" });
      return;
    }

    inTransaction(() => {
      createFriendship(user.id, request.requester_id);
      db.prepare(`
        UPDATE friend_requests
        SET status = 'accepted', responded_at = ?
        WHERE id = ?
      `).run(Date.now(), requestId);
    });

    res.json({ message: `You are now friends with ${request.name || request.email}` });
  });

  app.post("/api/friends/requests/:id/decline", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId)) {
      res.status(400).json({ error: "Invalid friend request" });
      return;
    }

    const result = db.prepare(`
      UPDATE friend_requests
      SET status = 'declined', responded_at = ?
      WHERE id = ? AND addressee_id = ? AND status = 'pending'
    `).run(Date.now(), requestId, user.id);
    if (!result.changes) {
      res.status(404).json({ error: "Friend request not found" });
      return;
    }

    res.json({ message: "Friend request declined" });
  });

  app.delete("/api/friends/:id", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const friendId = String(req.params.id || "");
    const [firstId, secondId] = friendshipPair(user.id, friendId);
    db.prepare("DELETE FROM friendships WHERE user_id = ? AND friend_id = ?").run(firstId, secondId);
    res.json({ message: "Friend removed" });
  });

  app.get("/api/coop/invites", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const invites = db.prepare(`
      SELECT
        ri.id,
        ri.room_id,
        ri.created_at,
        rooms.phase,
        inviter.id AS inviter_id,
        inviter.username AS inviter_username,
        inviter.name AS inviter_name,
        inviter.email AS inviter_email,
        inviter.picture AS inviter_picture
      FROM room_invites ri
      JOIN rooms ON rooms.id = ri.room_id
      JOIN users inviter ON inviter.id = ri.inviter_id
      WHERE ri.invitee_id = ?
        AND ri.status = 'pending'
        AND rooms.phase = 'lobby'
      ORDER BY ri.created_at DESC
    `).all(user.id).map(row => ({
      id: row.id,
      roomId: row.room_id,
      createdAt: row.created_at,
      phase: row.phase,
      inviter: publicFriendUser({
        id: row.inviter_id,
        username: row.inviter_username,
        name: row.inviter_name,
        email: row.inviter_email,
        picture: row.inviter_picture,
        created_at: row.created_at,
      }),
    }));

    res.json({ invites });
  });

  app.post("/api/coop/invites", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const roomId = String(req.body?.roomId || req.body?.room_id || "").trim();
    const inviteeId = String(req.body?.userId || req.body?.inviteeId || req.body?.invitee_id || "").trim();
    if (!roomId || !inviteeId) {
      res.status(400).json({ error: "Invalid invite" });
      return;
    }
    if (inviteeId === user.id) {
      res.status(400).json({ error: "You are already in this room" });
      return;
    }

    const room = db.prepare("SELECT id, phase FROM rooms WHERE id = ?").get(roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    if (room.phase !== "lobby") {
      res.status(400).json({ error: "This game has already started" });
      return;
    }
    if (!roomHasUser(roomId, user.id)) {
      res.status(403).json({ error: "Join the room before inviting friends" });
      return;
    }

    const invitee = db.prepare("SELECT * FROM users WHERE id = ?").get(inviteeId);
    if (!invitee) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    if (!areFriends(user.id, inviteeId)) {
      res.status(403).json({ error: "You can only invite friends" });
      return;
    }
    if (roomHasUser(roomId, inviteeId)) {
      res.status(400).json({ error: `${invitee.username || invitee.name || "That player"} is already in this room` });
      return;
    }

    db.prepare(`
      INSERT INTO room_invites (room_id, inviter_id, invitee_id, status, created_at, responded_at)
      VALUES (?, ?, ?, 'pending', ?, NULL)
      ON CONFLICT(room_id, invitee_id) DO UPDATE SET
        inviter_id = excluded.inviter_id,
        status = 'pending',
        created_at = excluded.created_at,
        responded_at = NULL
    `).run(roomId, user.id, inviteeId, Date.now());

    res.json({ message: `Invite sent to ${invitee.username || invitee.name || invitee.email}` });
  });

  app.post("/api/coop/invites/:id/dismiss", (req, res) => {
    const user = requireApiUser(req, res);
    if (!user) return;

    const inviteId = Number(req.params.id);
    if (!Number.isInteger(inviteId)) {
      res.status(400).json({ error: "Invalid invite" });
      return;
    }

    const result = db.prepare(`
      UPDATE room_invites
      SET status = 'dismissed', responded_at = ?
      WHERE id = ? AND invitee_id = ? AND status = 'pending'
    `).run(Date.now(), inviteId, user.id);
    if (!result.changes) {
      res.status(404).json({ error: "Invite not found" });
      return;
    }

    res.json({ message: "Invite dismissed" });
  });
}

module.exports = {
  registerSocialRoutes,
};
