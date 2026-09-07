import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  FaThermometerHalf,
  FaGasPump,
  FaBatteryQuarter,
  FaWifi,
  FaExclamationCircle,
  FaCheckDouble,
} from 'react-icons/fa';
import '../css/alarmsNotificationsCard.css';

/**
 * AlarmsNotificationsCard — recent alarms/notifications feed.
 *
 * Talks to the B5 API (GET /api/notifications, PATCH /api/notifications/:id/read).
 * Polls every POLL_MS so the badge/feed stay live without a page refresh, and
 * fires a toast the first time a CRITICAL, unread notification is seen —
 * never again for the same notification, even across polls.
 *
 * Drop it into any dashboard (Administrator now, Tenant later) — it needs
 * nothing from its parent, it reads the auth token itself like the rest of
 * the app does.
 */

const POLL_MS = 7000;   // 7s — inside the 5-10s window the B4 DoD asks for
const FETCH_LIMIT = 8;  // small feed, not a full inbox

const TYPE_ICON = {
  low_fuel: FaGasPump,
  high_temperature: FaThermometerHalf,
  battery_low: FaBatteryQuarter,
  sensor_offline: FaWifi,
  general_alarm: FaExclamationCircle,
  other: FaExclamationCircle,
};

// Small, dependency-free relative-time formatter — "4 min ago", "2 h ago" …
const timeAgo = (dateStr) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
};

function AlarmsNotificationsCard() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Notification ids we've already shown a toast for (or that already
  // existed on first load) — never toast for the same one twice.
  const seenIds = useRef(new Set());
  const firstLoad = useRef(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = window.localStorage.getItem('token');
      const res = await axios.get(`/api/notifications?limit=${FETCH_LIMIT}`, {
        headers: { Authorization: token },
      });
      const { notifications: list, unreadCount: count } = res.data;

      // Toast only for genuinely new CRITICAL + unread items — not on the
      // very first load (that would toast the whole backlog at once).
      if (!firstLoad.current) {
        list.forEach((n) => {
          if (!seenIds.current.has(n._id) && n.severity === 'critical' && !n.isRead) {
            toast.error(n.message, { autoClose: 6000 });
          }
        });
      }
      list.forEach((n) => seenIds.current.add(n._id));
      firstLoad.current = false;

      setNotifications(list);
      setUnreadCount(count);
    } catch (err) {
      console.error('[AlarmsNotificationsCard] fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_MS);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  const markRead = async (notifId) => {
    try {
      const token = window.localStorage.getItem('token');
      await axios.patch(`/api/notifications/${notifId}/read`, {}, {
        headers: { Authorization: token },
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === notifId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      toast.error('Could not mark notification as read');
    }
  };

  // No bulk endpoint exists yet on the backend, so "mark all" is a client-side
  // Promise.all over the individual PATCH — fine at this volume (a handful of
  // unread items), and doesn't require a new backend route.
  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    try {
      const token = window.localStorage.getItem('token');
      await Promise.all(
        unread.map((n) =>
          axios.patch(`/api/notifications/${n._id}/read`, {}, {
            headers: { Authorization: token },
          })
        )
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      toast.error('Could not mark all as read');
    }
  };

  return (
    <div className="alarms-card">
      <div className="alarms-card-header">
        <h3>Alarms &amp; notifications</h3>
        {unreadCount > 0 && <span className="alarms-header-dot" />}
      </div>

      <div className="alarms-list">
        {loading ? (
          <p className="alarms-empty">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="alarms-empty">No notifications yet.</p>
        ) : (
          notifications.map((n) => {
            const Icon = TYPE_ICON[n.type] || FaExclamationCircle;
            return (
              <div
                key={n._id}
                className={`alarms-item alarms-item-${n.severity}${n.isRead ? ' alarms-item-read' : ''}`}
                onClick={() => !n.isRead && markRead(n._id)}
                role={n.isRead ? undefined : 'button'}
                title={n.isRead ? undefined : 'Click to mark as read'}
              >
                <Icon className="alarms-item-icon" />
                <div className="alarms-item-body">
                  <div className="alarms-item-top">
                    <span className="alarms-item-message">{n.message}</span>
                    {!n.isRead && <span className="alarms-item-unread-dot" />}
                  </div>
                  {n.apartment?.name && (
                    <span className="alarms-item-context">
                      {n.apartment.name}
                      {n.apartment.floor ? ` · floor ${n.apartment.floor}` : ''}
                    </span>
                  )}
                  <span className="alarms-item-time">
                    {timeAgo(n.timestamp)} · {n.isRead ? 'read' : 'unread'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {unreadCount > 0 && (
        <div className="alarms-card-footer">
          <button onClick={markAllRead}>
            <FaCheckDouble /> Mark all read
          </button>
        </div>
      )}
    </div>
  );
}

export default AlarmsNotificationsCard;
