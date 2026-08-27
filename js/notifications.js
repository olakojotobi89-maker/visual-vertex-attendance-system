(function () {
  "use strict";

  let channel = null;
  let userId = null;
  let initialized = false;

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c]));

  const age = (v) => {
    if (!v) return "Just now";

    const seconds = Math.max(
      0,
      (Date.now() - new Date(v).getTime()) / 1000
    );

    if (seconds < 60) return `${Math.floor(seconds)}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

    return `${Math.floor(seconds / 86400)}d ago`;
  };

  /* ============================================================
     NOTIFICATION SOUND
     ============================================================ */

  function playNotificationSound() {
    try {
      const AudioCtx =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioCtx) return;

      const audio = new AudioCtx();

      if (audio.state === "suspended") {
        audio.resume().catch(() => {});
      }

      const now = audio.currentTime;

      const tones = [
        { frequency: 660, start: 0 },
        { frequency: 880, start: 0.12 }
      ];

      tones.forEach((tone) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = tone.frequency;

        const start = now + tone.start;

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
          0.08,
          start + 0.02
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + 0.22
        );

        oscillator.connect(gain);
        gain.connect(audio.destination);

        oscillator.start(start);
        oscillator.stop(start + 0.24);
      });

      setTimeout(() => {
        try {
          audio.close();
        } catch (_) {}
      }, 700);

    } catch (_) {}
  }


  /* ============================================================
     NOTIFICATION POPUP
     ============================================================ */

  function ensurePopupContainer() {
    let container = document.getElementById(
      "vsasNotificationPopups"
    );

    if (container) return container;

    container = document.createElement("div");

    container.id = "vsasNotificationPopups";

    container.style.position = "fixed";
    container.style.top = "80px";
    container.style.right = "24px";
    container.style.width =
      "min(390px, calc(100vw - 32px))";
    container.style.zIndex = "99999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "12px";
    container.style.pointerEvents = "none";

    document.body.appendChild(container);

    return container;
  }


  function showNotificationPopup(notification) {
    if (!notification) return;

    const container =
      ensurePopupContainer();

    const title =
      notification.title || "New Notification";

    const body =
      notification.body || "";

    const category =
      notification.category || "General";

    const popup =
      document.createElement("div");

    popup.style.pointerEvents = "auto";
    popup.style.background = "#ffffff";
    popup.style.border =
      "1px solid rgba(0,0,0,.08)";
    popup.style.borderRadius = "16px";
    popup.style.padding = "18px";
    popup.style.boxShadow =
      "0 18px 50px rgba(0,0,0,.18)";
    popup.style.fontFamily =
      "Poppins, sans-serif";
    popup.style.transform =
      "translateX(120%)";
    popup.style.opacity = "0";
    popup.style.transition =
      "transform .35s ease, opacity .35s ease";

    popup.innerHTML = `
      <div style="
        display:flex;
        align-items:flex-start;
        gap:12px;
      ">

        <div style="
          width:42px;
          height:42px;
          min-width:42px;
          border-radius:50%;
          background:#fff0f0;
          color:#ef3333;
          display:flex;
          align-items:center;
          justify-content:center;
        ">
          <svg
            viewBox="0 0 24 24"
            width="21"
            height="21"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path
              d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M13.73 21a2 2 0 0 1-3.46 0"
              stroke-linecap="round"
            />
          </svg>
        </div>

        <div style="flex:1;min-width:0;">

          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
          ">

            <strong style="
              font-size:15px;
              color:#171717;
              line-height:1.35;
            ">
              ${esc(title)}
            </strong>

            <button
              type="button"
              class="vsas-popup-close"
              aria-label="Close notification"
              style="
                border:0;
                background:none;
                cursor:pointer;
                color:#777;
                font-size:20px;
                line-height:1;
                padding:0;
              "
            >
              ×
            </button>

          </div>

          <div style="
            margin-top:5px;
            font-size:11px;
            font-weight:600;
            color:#ef3333;
            text-transform:uppercase;
            letter-spacing:.04em;
          ">
            ${esc(category)}
          </div>

          <div style="
            margin-top:8px;
            color:#555;
            font-size:13px;
            line-height:1.55;
            white-space:pre-wrap;
            word-break:break-word;
          ">
            ${esc(body)}
          </div>

          <div style="
            margin-top:10px;
            color:#999;
            font-size:11px;
          ">
            Just now
          </div>

        </div>
      </div>
    `;

    container.appendChild(popup);

    requestAnimationFrame(() => {
      popup.style.transform =
        "translateX(0)";

      popup.style.opacity = "1";
    });

    const closePopup = () => {
      popup.style.transform =
        "translateX(120%)";

      popup.style.opacity = "0";

      setTimeout(() => {
        popup.remove();
      }, 350);
    };

    const closeButton =
      popup.querySelector(
        ".vsas-popup-close"
      );

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        closePopup
      );
    }

    /*
     * Automatically disappear after 8 seconds.
     */
    setTimeout(closePopup, 8000);
  }


  /* ============================================================
     NOTIFICATION LIST
     ============================================================ */

  async function loadNotifications(
    playSound = false
  ) {
    const list =
      document.getElementById(
        "notificationList"
      ) ||
      document.getElementById(
        "notificationsList"
      );

    if (!list || !userId) return;

    const {
      data,
      error
    } = await window.supabaseClient
      .from("notification_recipients")
      .select(`
        notification_id,
        read_at,
        dismissed_at,
        created_at,
        notifications(
          title,
          body,
          category,
          published_at
        )
      `)
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .order("created_at", {
        ascending: false
      })
      .limit(50);

    if (error) {
      console.error(
        "Notification loading error:",
        error
      );

      list.innerHTML =
        '<p class="notification-item">Could not load notifications.</p>';

      return;
    }

    const rows = data || [];

    const unread = rows.filter(
      (row) => !row.read_at
    ).length;

    updateNotificationDots(unread);

    if (!rows.length) {
      list.innerHTML =
        '<p class="notification-item">No new notifications.</p>';

      return;
    }

    list.innerHTML = rows
      .map((row) => {
        const notification =
          row.notifications || {};

        return `
          <button
            type="button"
            class="notification-item${
              row.read_at
                ? ""
                : " notification-item--unread"
            }"
            data-id="${esc(
              row.notification_id
            )}"
            role="menuitem"
          >

            <span class="notification-item-dot"></span>

            <span>
              <strong>
                ${esc(
                  notification.title ||
                  "Notification"
                )}
              </strong>

              <br>

              ${esc(
                notification.body || ""
              )}

              <br>

              <time>
                ${esc(
                  notification.category ||
                  "General"
                )}
                ·
                ${esc(
                  age(
                    notification.published_at ||
                    row.created_at
                  )
                )}
              </time>
            </span>

          </button>
        `;
      })
      .join("");

    list
      .querySelectorAll("[data-id]")
      .forEach((item) => {

        item.addEventListener(
          "click",
          async () => {

            await window.supabaseClient
              .from(
                "notification_recipients"
              )
              .update({
                read_at:
                  new Date().toISOString()
              })
              .eq(
                "notification_id",
                item.dataset.id
              )
              .eq(
                "user_id",
                userId
              );

            await loadNotifications(false);
          }
        );

      });

    if (playSound) {
      playNotificationSound();
    }
  }


  /* ============================================================
     NOTIFICATION DOT
     ============================================================ */

  function updateNotificationDots(unread) {
    const dots =
      document.querySelectorAll(
        ".notif-dot, #notificationDot"
      );

    dots.forEach((dot) => {
      dot.style.display =
        unread > 0
          ? "block"
          : "none";
    });
  }


  /* ============================================================
     GET NOTIFICATION
     ============================================================ */

  async function getNotification(
    notificationId
  ) {
    if (!notificationId) return null;

    const {
      data,
      error
    } = await window.supabaseClient
      .from("notifications")
      .select(`
        id,
        title,
        body,
        category,
        published_at,
        status
      `)
      .eq("id", notificationId)
      .maybeSingle();

    if (error) {
      console.error(
        "Could not fetch notification:",
        error
      );

      return null;
    }

    return data || null;
  }


  /* ============================================================
     MARK NOTIFICATION AS DELIVERED
     ============================================================ */

  async function markNotificationDelivered(
    notificationId
  ) {
    if (!notificationId || !userId) return;

    const { error } =
      await window.supabaseClient
        .from("notification_recipients")
        .update({
          delivered_at:
            new Date().toISOString()
        })
        .eq(
          "notification_id",
          notificationId
        )
        .eq(
          "user_id",
          userId
        )
        .is(
          "delivered_at",
          null
        );

    if (error) {
      console.error(
        "[VSAS] Failed to mark notification as delivered:",
        error
      );
    }
  }


  /* ============================================================
     OFFLINE / PENDING NOTIFICATIONS

     Notifications received while the user was not online
     remain with delivered_at = NULL.

     When they return and login, this function displays
     the popup and plays the notification sound.
     ============================================================ */

  async function showPendingNotifications() {
    if (
      !userId ||
      !window.supabaseClient
    ) {
      return;
    }

    const {
      data,
      error
    } = await window.supabaseClient
      .from("notification_recipients")
      .select(`
        notification_id,
        created_at,
        notifications(
          id,
          title,
          body,
          category,
          published_at,
          status
        )
      `)
      .eq("user_id", userId)
      .is("dismissed_at", null)
      .is("delivered_at", null)
      .order("created_at", {
        ascending: true
      });

    if (error) {
      console.error(
        "[VSAS] Failed to load pending notifications:",
        error
      );

      return;
    }

    const pending = data || [];

    if (!pending.length) return;

    pending.forEach(
      (row, index) => {

        setTimeout(
          async () => {

            const notification =
              row.notifications;

            if (!notification) return;

            /*
             * Show the notification popup.
             */
            showNotificationPopup(
              notification
            );

            /*
             * Play notification sound.
             */
            playNotificationSound();

            /*
             * Mark as delivered so it will
             * not show again on the next login.
             */
            await markNotificationDelivered(
              row.notification_id
            );

          },
          index * 1200
        );

      }
    );
  }


  /* ============================================================
     REALTIME NOTIFICATIONS
     ============================================================ */

  function subscribeToNotifications() {

    if (
      !userId ||
      !window.supabaseClient
    ) {
      return;
    }

    if (channel) {
      try {
        window.supabaseClient
          .removeChannel(channel);
      } catch (_) {}
    }

    channel =
      window.supabaseClient
        .channel(
          `vsas-notifications-${userId}`
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table:
              "notification_recipients",
            filter:
              `user_id=eq.${userId}`
          },

          async (payload) => {

            console.log(
              "🔔 New VSAS notification:",
              payload
            );

            const notificationId =
              payload?.new
                ?.notification_id;

            if (!notificationId) return;

            const notification =
              await getNotification(
                notificationId
              );

            if (!notification) {
              await loadNotifications(false);
              return;
            }

            /*
             * Immediately show popup.
             */
            showNotificationPopup(
              notification
            );

            /*
             * Play notification sound.
             */
            playNotificationSound();

            /*
             * Mark the notification as delivered.
             */
            await markNotificationDelivered(
              notificationId
            );

            /*
             * Refresh notification list
             * and unread counter.
             */
            await loadNotifications(false);

          }
        )
        .subscribe((status) => {

          console.log(
            "VSAS notification realtime:",
            status
          );

        });
  }


  /* ============================================================
     ENABLE AUDIO AFTER USER INTERACTION
     ============================================================ */

  function enableNotificationAudio() {

    document.addEventListener(
      "click",

      () => {

        try {

          const AudioCtx =
            window.AudioContext ||
            window.webkitAudioContext;

          if (!AudioCtx) return;

          const ctx =
            new AudioCtx();

          if (
            ctx.state === "suspended"
          ) {
            ctx.resume()
              .catch(() => {});
          }

          setTimeout(() => {

            try {
              ctx.close();
            } catch (_) {}

          }, 200);

        } catch (_) {}

      },

      {
        once: true,
        passive: true
      }
    );
  }


  /* ============================================================
     INITIALIZE
     ============================================================ */

  async function initialize() {

    if (initialized) return;

    initialized = true;

    if (
      !window.supabaseClient ||
      !window.VSASAuth
    ) {

      console.error(
        "VSAS notification dependencies are missing."
      );

      return;
    }

    const auth =
      await window.VSASAuth
        .requireAuth();

    if (!auth) return;

    userId =
      auth.user.id;

    /*
     * Enable notification audio.
     */
    enableNotificationAudio();

    /*
     * Load the notification list first.
     */
    await loadNotifications(false);

    /*
     * Start listening for new notifications.
     */
    subscribeToNotifications();

    /*
     * IMPORTANT:
     *
     * Check for notifications that arrived
     * while the staff member was offline.
     *
     * Small delay allows the page to finish
     * loading before popups appear.
     */
    setTimeout(() => {

      showPendingNotifications();

    }, 800);

  }


  /* ============================================================
     CLEANUP
     ============================================================ */

  window.addEventListener(
    "beforeunload",

    () => {

      if (
        channel &&
        window.supabaseClient
      ) {

        try {

          window.supabaseClient
            .removeChannel(channel);

        } catch (_) {}

      }

    }
  );


  /* ============================================================
     START
     ============================================================ */

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );

})();