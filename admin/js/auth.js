// Módulo de autenticación y autorización para AGM Admin.
// Valida sesión y membresía activa en staff_profiles.

(function () {
  const config = window.AGM_CONFIG;
  if (!config || !window.supabase) {
    console.error("Supabase client o AGM_CONFIG no disponibles.");
    return;
  }

  const client = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY,
  );

  window.AGM_AUTH = {
    client,

    async getCurrentStaffUser() {
      const {
        data: { user },
        error: userError,
      } = await client.auth.getUser();

      if (userError || !user) {
        return null;
      }

      // Validar contra staff_profiles que el usuario sea personal activo
      const { data: profile, error: profileError } = await client
        .from("staff_profiles")
        .select("user_id, full_name, role, active")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      if (profileError || !profile) {
        return { user, isStaff: false, profile: null };
      }

      return { user, isStaff: true, profile };
    },

    async requireActiveStaff() {
      const staffInfo = await this.getCurrentStaffUser();
      if (!staffInfo || !staffInfo.isStaff) {
        // Si hay una sesión pero no es staff activo, cerramos sesión de inmediato
        await client.auth.signOut();
        window.location.href = "../login/";
        return null;
      }
      return staffInfo;
    },

    async redirectIfAuthenticated() {
      const staffInfo = await this.getCurrentStaffUser();
      if (staffInfo && staffInfo.isStaff) {
        window.location.href = "../flota/";
      }
    },

    async signOut() {
      await client.auth.signOut();
      window.location.href = "../login/";
    },
  };
})();
