const supabase = require('../config/supabaseClient');

// Internal helper - other controllers (e.g. parkingController) can call
// this directly to create a notification without going through the API.
// Example: notify a driver once their session/ticket is ready.
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
// Returns all notifications for a driver, newest first.
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
// Marks a single notification as read.
// ------------------------------------------------------------
async function markAsRead(req, res) {
  try {
    const { id } = req.params;

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ notification });
  } catch (err) {
    console.error('markAsRead error:', err.message);
    res.status(500).json({ error: 'Could not update notification' });
  }
}

module.exports = { createNotification, getNotifications, markAsRead };
