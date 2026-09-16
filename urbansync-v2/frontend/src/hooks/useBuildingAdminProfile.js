import { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * useBuildingAdminProfile
 *
 * Fetches the logged-in Building Administrator's profile and building info.
 * Used by every Building Admin page so the sidebar always shows the correct
 * user name and building address — not a hardcoded "Administrator".
 *
 * Returns:
 *   userName     — string (user's full name)
 *   buildingInfo — { address, apartments, floors } | null
 *   profileId    — string (profile._id, used to scope API calls)
 *   userId       — string (user._id)
 *   loading      — boolean
 */
export function useBuildingAdminProfile() {
  const [userName,     setUserName]     = useState('Administrator');
  const [buildingInfo, setBuildingInfo] = useState(null);
  const [profileId,    setProfileId]    = useState(null);
  const [userId,       setUserId]       = useState(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token   = window.localStorage.getItem('token');
        const headers = { Authorization: token };

        const profileRes = await axios.get('/api/profile', { headers });
        const profile    = profileRes.data;

        setUserName(profile.name || 'Administrator');
        setProfileId(profile.profileId);
        setUserId(profile.userId);

        // Fetch building for sidebar address
        if (profile.profileId) {
          try {
            const buildingRes  = await axios.get(`/api/buildings/${profile.profileId}`, { headers });
            const b            = buildingRes.data;
            setBuildingInfo({
              address:    b.address,
              apartments: b.apartments,
              floors:     b.floors,
            });
          } catch (bErr) {
            console.error('[useBuildingAdminProfile] building fetch failed:', bErr.message);
          }
        }
      } catch (err) {
        console.error('[useBuildingAdminProfile] profile fetch failed:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  return { userName, buildingInfo, profileId, userId, loading };
}