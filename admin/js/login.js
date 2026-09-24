// Lógica de inicio de sesión administrativo con validación de staff_profiles.

document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.AGM_AUTH;
  if (!auth) return;

  // Si ya tiene sesión de personal activo, redirigir automáticamente
  await auth.redirectIfAuthenticated();

  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("loginSubmitBtn");
  const errorAlert = document.getElementById("loginErrorAlert");

  const showError = (msg) => {
    errorAlert.textContent = msg;
    errorAlert.style.display = "block";
  };

  const hideError = () => {
    errorAlert.textContent = "";
    errorAlert.style.display = "none";
  };

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError("Por favor ingresa tu correo y contraseña.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Iniciando sesión...";

    try {
      // 1. Iniciar sesión con Supabase Auth
      const { data, error: authError } =
        await auth.client.auth.signInWithPassword({
          email,
          password,
        });

      if (authError || !data?.user) {
        showError(
          authError?.message === "Invalid login credentials"
            ? "Credenciales incorrectas. Verifica tu correo y contraseña."
            : (authError?.message || "Error al iniciar sesión."),
        );
        submitBtn.disabled = false;
        submitBtn.textContent = "Iniciar sesión";
        return;
      }

      // 2. Validar inmediatamente si pertenece a personal activo
      const { data: profile, error: profileError } = await auth.client
        .from("staff_profiles")
        .select("user_id, role, active")
        .eq("user_id", data.user.id)
        .eq("active", true)
        .maybeSingle();

      if (profileError || !profile) {
        // Usuario autenticado pero NO es personal activo
        await auth.client.auth.signOut();
        showError(
          "Acceso denegado. Tu cuenta no cuenta con permisos de personal activo en AGM Rent a Car.",
        );
        submitBtn.disabled = false;
        submitBtn.textContent = "Iniciar sesión";
        return;
      }

      // 3. Personal activo verificado: redirigir a /admin/flota
      window.location.href = "../flota/";
    } catch (err) {
      console.error("Error inesperado en login:", err);
      showError("Ocurrió un error al procesar la solicitud. Intenta nuevamente.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Iniciar sesión";
    }
  });
});
