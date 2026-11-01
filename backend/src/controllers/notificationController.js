const supabase = require('../config/supabaseClient');
const { isOwnerOrAdmin } = require('../middleware/authMiddleware');

// Internal helper used by other controllers to create a notification.
async function createNotification(user_id, message, type = 'general') {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{ user_id, message, type }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// GET /api/notifications/:user_id
// (route-level requireSelf confirms the caller owns :user_id)
// ------------------------------------------------------------
async function getNotifications(req, res) {
  try {
    const { user_id } = req.params;

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ notifications });
  } catch (err) {
    console.error('getNotifications error:', err.message);
    res.status(500).json({ error: 'Could not fetch notifications' });
  }
}

// ------------------------------------------------------------
// PATCH /api/notifications/:id/read
// Only the notification's owner (or an admin) can mark it as read.
// ------------------------------------------------------------
async function markAsRead(req, res) {
  try {
    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (!isOwnerOrAdmin(req, existing.user_id)) {
      return res.status(403).json({ error: 'You can only update your own notifications' });
    }

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ notification });
  } catch (err) {
    console.error('markAsRead error:', err.message);
    res.status(500).json({ error: 'Could not update notification' });
  }
}

module.exports = { createNotification, getNotifications, markAsRead };
