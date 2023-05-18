function generateUUID() {
  // Public Domain/MIT
  var d = new Date().getTime(); //Timestamp
  var d2 =
    (typeof performance !== "undefined" &&
      performance.now &&
      performance.now() * 1000) ||
    0; //Time in microseconds since page-load or 0 if unsupported
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = Math.random() * 16; //random number between 0 and 16
    if (d > 0) {
      //Use timestamp until depleted
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      //Use microseconds since page-load if supported
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const obeserver = new MutationObserver((mutations) => {
  //   console.log(mutations);
  mutations.map((mutation) => {
    const targetEle = mutation.target;
    if (targetEle) {
      if (targetEle.classList.contains("notion-overlay-container")) {
        // Overlay is added
        try {
          const shareMenu = document.querySelector(".notion-share-menu");
          const shareMenuContainer = shareMenu.querySelector(
            ".notion-scroller > div"
          );

          if (!shareMenu.querySelector("#remove-permission")) {
            const newButton = document.createElement("button");
            newButton.innerText = "Remove All Permissions";
            newButton.id = "remove-permission";

            newButton.style.margin = "0px 15px";
            newButton.style.background = "#dd1717";
            newButton.style.color = "white";
            newButton.style.border = "0px";
            newButton.style.padding = "10px 15px";
            newButton.style.borderRadius = "5px";
            newButton.style.fontSize = "14px";
            newButton.style.fontWeight = "bold";

            shareMenuContainer.insertBefore(
              newButton,
              shareMenuContainer.childNodes[1]
            );

            newButton.addEventListener("click", async () => {
              const spacesRes = await fetch(
                "https://www.notion.so/api/v3/getSpaces",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",

                    //   "Notion-Audit-Log-Platform": "web",
                    //   "Notion-Client-Version": "23.12.0.98"
                    //   "x-notion-active-user-header: 9c949432-6809-4ab2-a8d1-e7cacbe93031"
                  },
                }
              );
              const spaces = await spacesRes.json();

              // if (!spaceID) {
              // const spacesEntries = Object.entries(spaces)[0];
              // const spaceEntries = Object.entries(spacesEntries[1].space)[0];
              // spaceID = spaceEntries[0];
              // }

              // console.log(spaces);

              // Get Notion Post ID
              const url = new URL(window.location);

              if (url.searchParams.get("p")) {
                pageCombined = url.searchParams.get("p");
              } else if (url.pathname.lastIndexOf("-") === -1) {
                // Table Page View
                pageCombined = url.pathname.split("/")[1];
              } else {
                let page = url.pathname;
                pageCombined = page.slice(page.lastIndexOf("-") + 1);
              }

              const pageID = `${pageCombined.slice(0, 8)}-${pageCombined.slice(
                8,
                12
              )}-${pageCombined.slice(12, 16)}-${pageCombined.slice(
                16,
                20
              )}-${pageCombined.slice(20)}`;

              const spacePayload = {
                type: "block-space",
                name: "page",
                blockId: pageID,
                spaceDomain: "",
                showMoveTo: false,
                saveParent: false,
                shouldDuplicate: false,
                projectManagementLaunch: false,
                requestedOnPublicDomain: false,
                configureOpenInDesktopApp: false,
                mobileData: { isPush: false },
              };

              const publicDataRes = await fetch(
                "https://www.notion.so/api/v3/getPublicPageData",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(spacePayload),
                }
              );
              const publicData = await publicDataRes.json();
              let spaceID = publicData.spaceId;

              let activeSpace = Object.entries(spaces).filter((each) => {
                if (each[1].space) {
                  if (Object.keys(each[1].space)[0] == spaceID) {
                    // console.log("spaceFilter", each);
                    return true;
                  }
                }
              });

              // if (!spaceID) {
              //   const spacesEntries = Object.entries(spaces)[0];
              //   const spaceEntries = Object.entries(spacesEntries[1].space)[0];
              //   console.log(spacesEntries[1]);
              //   spaceID = spaceEntries[0];
              //   activeSpace = Object.entries(spaces);
              // }

              const activeUser = Object.keys(activeSpace[0][1].notion_user)[0];

              // Get Visible Users
              const visibleUsersPayload = {
                spaceId: spaceID,
              };

              const visibleUserRes = await fetch(
                `https://www.notion.so/api/v3/getVisibleUsers`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-notion-active-user-header": activeUser,
                  },
                  body: JSON.stringify(visibleUsersPayload),
                }
              );
              const visibleUser = await visibleUserRes.json();

              const requestID = generateUUID();

              const transactions = visibleUser.users
                .filter((user) => {
                  return user.isPageGuest;
                })
                .filter((user) => {
                  return user.guestPageIds.includes(pageID);
                })
                .map((user) => {
                  const pointerID = generateUUID();
                  return {
                    id: pointerID,
                    spaceId: spaceID,
                    debug: {
                      userAction: "PermissionItem.handlePermissionItemChange",
                    },
                    operations: [
                      {
                        pointer: {
                          table: "block",
                          // id: "5b707fa4-c3d4-484c-a43b-944f816be252",
                          id: pageID,
                          spaceId: spaceID,
                        },
                        command: "setPermissionItem",
                        path: ["permissions"],
                        args: {
                          role: "none",
                          type: "user_permission",
                          user_id: user.userId,
                          invite_id: pointerID,
                        },
                      },
                    ],
                  };
                });

              // Permission Edit
              const permissionPayload = {
                requestId: requestID,
                transactions: transactions,
              };

              fetch("https://www.notion.so/api/v3/saveTransactions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-notion-active-user-header": activeUser,
                },
                body: JSON.stringify(permissionPayload),
              });
            });
          }
        } catch (e) {
          console.log(e);
        }
      }
    }
  });
});

obeserver.observe(document.querySelector("body"), {
  childList: true,
  subtree: true,
});
