(function () {
  "use strict";

  let channel = null;
  let userId = null;

  /* =========================================================
     HELPERS
  ========================================================= */

  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[c]
    );

  const age = (v) => {
    if (!v) return "";

    const date = new Date(v);

    if (Number.isNaN(date.getTime())) return "";

    const s = Math.max(
      0,
      (Date.now() - date.getTime()) / 1000
    );

    return s < 60
      ? `${Math.floor(s)}s ago`
      : s < 3600
      ? `${Math.floor(s / 60)}m ago`
      : s < 86400
      ? `${Math.floor(s / 3600)}h ago`
      : `${Math.floor(s / 86400)}d ago`;
  };


  /* =========================================================
     NOTIFICATION SOUND
  ========================================================= */

  function sound() {
    try {
      const C =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!C) return;

      const x = new C();
      const t = x.currentTime;

      [660, 880].forEach((f, i) => {
        const o = x.createOscillator();
        const g = x.createGain();

        const n = t + i * 0.1;

        o.type = "sine";
        o.frequency.value = f;

        g.gain.setValueAtTime(0.0001, n);

        g.gain.exponentialRampToValueAtTime(
          0.07,
          n + 0.02
        );

        g.gain.exponentialRampToValueAtTime(
          0.0001,
          n + 0.2
        );

        o.connect(g).connect(x.destination);

        o.start(n);
        o.stop(n + 0.22);
      });

      setTimeout(() => {
        try {
          x.close();
        } catch (_) {}
      }, 600);

    } catch (_) {}
  }


  /* =========================================================
     LOAD NOTIFICATIONS
  ========================================================= */

  async function load(playSound = false) {

    const list =
      document.getElementById("notificationList") ||
      document.getElementById("notificationsList");

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
          published_at,
          status
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
      (r) => !r.read_at
    ).length;

    const dot =
      document.getElementById("notificationDot");

    if (dot) {
      dot.style.display =
        unread > 0 ? "block" : "none";
    }


    /* ---------------------------------------------------------
       Empty state
    --------------------------------------------------------- */

    if (!rows.length) {
      list.innerHTML =
        '<p class="notification-item">No new notifications.</p>';

      return;
    }


    /* ---------------------------------------------------------
       Render notifications
    --------------------------------------------------------- */

    list.innerHTML = rows
      .map((r) => {

        const n = r.notifications || {};

        return `
          <button
            type="button"
            class="notification-item${
              r.read_at
                ? ""
                : " notification-item--unread"
            }"
            data-id="${esc(r.notification_id)}"
            role="menuitem"
          >

            <span class="notification-item-dot"></span>

            <span>
              <strong>
                ${esc(
                  n.title ||
                  "Notification"
                )}
              </strong>

              <br>

              ${esc(n.body || "")}

              <br>

              <time>
                ${esc(
                  n.category ||
                  "General"
                )}
                ${
                  n.published_at
                    ? ` · ${esc(
                        age(
                          n.published_at
                        )
                      )}`
                    : ""
                }
              </time>
            </span>

          </button>
        `;
      })
      .join("");


    /* ---------------------------------------------------------
       Mark notification as read
    --------------------------------------------------------- */

    list
      .querySelectorAll("[data-id]")
      .forEach((item) => {

        item.addEventListener(
          "click",
          async () => {

            const notificationId =
              item.dataset.id;

            const {
              error
            } = await window.supabaseClient
              .from(
                "notification_recipients"
              )
              .update({
                read_at:
                  new Date().toISOString()
              })
              .eq(
                "notification_id",
                notificationId
              )
              .eq(
                "user_id",
                userId
              );

            if (error) {
              console.error(
                "Could not mark notification as read:",
                error
              );

              return;
            }

            await load(false);
          }
        );
      });


    if (playSound) {
      sound();
    }
  }


  /* =========================================================
     SEND NOTIFICATION TO ALL STAFF
  ========================================================= */

  async function sendNotificationToAllStaff(
    title,
    message,
    type
  ) {

    if (!window.supabaseClient) {
      throw new Error(
        "Supabase client is not available."
      );
    }


    /* ---------------------------------------------------------
       Validate
    --------------------------------------------------------- */

    title = String(title || "").trim();
    message = String(message || "").trim();
    type = String(type || "General").trim();


    if (!title) {
      throw new Error(
        "Please enter a notification title."
      );
    }


    if (!message) {
      throw new Error(
        "Please enter a notification message."
      );
    }


    if (
      ![
        "General",
        "Announcement",
        "Urgent"
      ].includes(type)
    ) {
      type = "General";
    }


    /* ---------------------------------------------------------
       Call secure Supabase RPC
    --------------------------------------------------------- */

    const {
      data,
      error
    } = await window.supabaseClient.rpc(
      "send_notification_to_all_staff",
      {
        p_title: title,
        p_body: message,
        p_category: type
      }
    );


    if (error) {
      console.error(
        "Send notification error:",
        error
      );

      throw new Error(
        error.message ||
        "Unable to send notification."
      );
    }


    return data;
  }


  /* =========================================================
     FIND NOTIFICATION MODAL
  ========================================================= */

  function getNotificationModal() {

    /*
      We intentionally don't depend on one specific modal ID.

      This allows the code to work with your existing UI.
    */

    const candidates = [
      "#notifyAllModal",
      "#notificationModal",
      "#notifyModal",
      ".notify-all-modal",
      ".notification-modal"
    ];

    for (const selector of candidates) {

      const element =
        document.querySelector(selector);

      if (element) {
        return element;
      }
    }


    /*
      Fallback:
      Find a visible element containing
      "Notify All Staff".
    */

    const elements =
      document.querySelectorAll(
        "div, section, dialog"
      );

    for (const element of elements) {

      if (
        element.textContent
          ?.trim()
          .includes("Notify All Staff")
      ) {

        const style =
          window.getComputedStyle(element);

        if (
          style.display !== "none" &&
          style.visibility !== "hidden"
        ) {
          return element;
        }
      }
    }

    return null;
  }


  /* =========================================================
     FIND MODAL FIELDS
  ========================================================= */

  function getNotificationFields(modal) {

    if (!modal) return null;


    /*
      First try common IDs.
    */

    const title =
      modal.querySelector(
        "#notificationTitle"
      ) ||
      modal.querySelector(
        "#notifyTitle"
      ) ||
      modal.querySelector(
        'input[name="title"]'
      );


    const message =
      modal.querySelector(
        "#notificationMessage"
      ) ||
      modal.querySelector(
        "#notifyMessage"
      ) ||
      modal.querySelector(
        'textarea[name="message"]'
      );


    const type =
      modal.querySelector(
        "#notificationType"
      ) ||
      modal.querySelector(
        "#notifyType"
      ) ||
      modal.querySelector(
        'select[name="type"]'
      );


    /*
      If IDs/names don't exist, use the
      visible input structure in your modal.
    */

    const inputs =
      modal.querySelectorAll(
        "input, textarea, select"
      );


    let fallbackTitle = title;
    let fallbackMessage = message;
    let fallbackType = type;


    if (!fallbackTitle) {

      fallbackTitle =
        Array.from(inputs).find(
          (el) =>
            el.tagName === "INPUT" &&
            el.type !== "hidden"
        ) || null;
    }


    if (!fallbackMessage) {

      fallbackMessage =
        modal.querySelector(
          "textarea"
        ) || null;
    }


    if (!fallbackType) {

      fallbackType =
        modal.querySelector(
          "select"
        ) || null;
    }


    return {
      title: fallbackTitle,
      message: fallbackMessage,
      type: fallbackType
    };
  }


  /* =========================================================
     SHOW SEND STATUS
  ========================================================= */

  function setSendButtonState(
    button,
    sending
  ) {

    if (!button) return;


    if (sending) {

      if (
        !button.dataset.originalText
      ) {
        button.dataset.originalText =
          button.textContent;
      }

      button.disabled = true;

      button.textContent =
        "Sending...";
    }

    else {

      button.disabled = false;

      if (
        button.dataset.originalText
      ) {
        button.textContent =
          button.dataset.originalText;
      }
    }
  }


  /* =========================================================
     SEND BUTTON HANDLER
  ========================================================= */

  async function handleSendToAllStaff(
    button
  ) {

    const modal =
      getNotificationModal();

    if (!modal) {

      console.error(
        "Notification modal could not be found."
      );

      alert(
        "Notification window could not be found."
      );

      return;
    }


    const fields =
      getNotificationFields(modal);


    if (
      !fields ||
      !fields.title ||
      !fields.message
    ) {

      console.error(
        "Notification fields could not be found."
      );

      alert(
        "Notification form fields could not be found."
      );

      return;
    }


    const title =
      fields.title.value.trim();

    const message =
      fields.message.value.trim();

    const type =
      fields.type?.value ||
      "General";


    /* ---------------------------------------------------------
       Confirm empty fields
    --------------------------------------------------------- */

    if (!title) {

      alert(
        "Please enter a notification title."
      );

      fields.title.focus();

      return;
    }


    if (!message) {

      alert(
        "Please enter a notification message."
      );

      fields.message.focus();

      return;
    }


    /* ---------------------------------------------------------
       Send
    --------------------------------------------------------- */

    setSendButtonState(
      button,
      true
    );


    try {

      const notificationId =
        await sendNotificationToAllStaff(
          title,
          message,
          type
        );


      console.log(
        "Notification sent successfully:",
        notificationId
      );


      /*
        Clear the form.
      */

      fields.title.value = "";

      fields.message.value = "";

      if (fields.type) {
        fields.type.value =
          "General";
      }


      /*
        Close modal.

        We try common close buttons first.
      */

      const closeButton =
        modal.querySelector(
          "[data-close]"
        ) ||
        modal.querySelector(
          ".modal-close"
        ) ||
        modal.querySelector(
          ".close-modal"
        );


      if (closeButton) {
        closeButton.click();
      }


      /*
        If your modal uses hidden/class-based
        closing, try the common patterns.
      */

      modal.classList.remove(
        "active",
        "show",
        "open"
      );


      modal.setAttribute(
        "aria-hidden",
        "true"
      );


      /*
        Reload notifications.
      */

      await load(false);


      /*
        Success message.
      */

      alert(
        "Notification sent successfully to all active staff."
      );

    }

    catch (error) {

      console.error(
        error
      );


      alert(
        error.message ||
        "Failed to send notification."
      );
    }

    finally {

      setSendButtonState(
        button,
        false
      );
    }
  }


  /* =========================================================
     DETECT "SEND TO ALL STAFF" BUTTON
  ========================================================= */

  document.addEventListener(
    "click",
    async (event) => {

      const button =
        event.target.closest(
          "button"
        );

      if (!button) return;


      const text =
        button.textContent
          ?.trim()
          .toLowerCase();


      /*
        Match your exact button:

        "Send to All Staff"
      */

      if (
        text !==
        "send to all staff"
      ) {
        return;
      }


      /*
        Prevent any old handler from
        submitting the form normally.
      */

      event.preventDefault();

      event.stopPropagation();


      await handleSendToAllStaff(
        button
      );
    },
    true
  );


  /* =========================================================
     INITIALIZE
  ========================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    async () => {

      try {

        const auth =
          await window.VSASAuth.requireAuth();

        if (!auth) return;

        userId =
          auth.user.id;


        /*
          Initial notification load.
        */

        await load(false);


        /* -----------------------------------------------------
           Realtime notification listener
        ----------------------------------------------------- */

        channel =
          window.supabaseClient
            .channel(
              `vsas-notifications:${userId}`
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
              async () => {

                console.log(
                  "New VSAS notification received."
                );

                await load(true);
              }
            )
            .subscribe(
              (status) => {

                console.log(
                  "Notification realtime status:",
                  status
                );
              }
            );

      }

      catch (error) {

        console.error(
          "Notification initialization failed:",
          error
        );
      }
    }
  );


  /* =========================================================
     CLEANUP
  ========================================================= */

  window.addEventListener(
    "beforeunload",
    () => {

      if (
        channel &&
        window.supabaseClient
      ) {

        window.supabaseClient
          .removeChannel(channel);

        channel = null;
      }
    }
  );


  /* =========================================================
     EXPOSE FUNCTIONS
  ========================================================= */

  window.VSASNotifications = {
    load,
    sendNotificationToAllStaff,
    markAsRead: async (
      notificationId
    ) => {

      if (!userId) return false;

      const {
        error
      } = await window.supabaseClient
        .from(
          "notification_recipients"
        )
        .update({
          read_at:
            new Date().toISOString()
        })
        .eq(
          "notification_id",
          notificationId
        )
        .eq(
          "user_id",
          userId
        );

      if (error) {
        console.error(
          error
        );

        return false;
      }

      await load(false);

      return true;
    }
  };

})();