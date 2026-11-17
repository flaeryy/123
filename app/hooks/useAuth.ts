type AuthUser = {
  id: number;
  username: string;
  email: string;
};

export function useAuth(apiUrl: string) {
  async function logout() {
    const token = sessionStorage.getItem("belot_session");

    if (token) {
      const response = await fetch(`${apiUrl}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message ?? "Odjava nije uspjela.");
      }
    }

    sessionStorage.removeItem("belot_session");
    sessionStorage.removeItem("belot_user");
  }

  return { logout, restoreSession };
}

function restoreSession(): AuthUser | null {
  const savedToken = sessionStorage.getItem("belot_session");
  const savedUser = sessionStorage.getItem("belot_user");

  if (savedToken && savedUser) {
    try {
      return JSON.parse(savedUser) as AuthUser;
    } catch {
      sessionStorage.removeItem("belot_session");
      sessionStorage.removeItem("belot_user");
    }
  }

  return null;
}
