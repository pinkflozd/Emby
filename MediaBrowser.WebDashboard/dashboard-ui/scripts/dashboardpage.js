define(["datetime", "jQuery", "dom", "loading", "humanedate", "cardStyle", "listViewStyle"], function(datetime, $, dom, loading) {
    "use strict";

    function renderNoHealthAlertsMessage(page) {
        var html = '<p style="padding:0 .5em;display:flex;align-items:center;">';
        html += '<iron-icon icon="check" style="margin-right:.5em;background-color: #52B54B;border-radius:1em;color: #fff;"></iron-icon>', html += Globalize.translate("HealthMonitorNoAlerts") + "</p>", page.querySelector(".healthMonitor").innerHTML = html
    }

    function refreshHealthMonitor(page) {
        renderNoHealthAlertsMessage(page)
    }

    function onConnectionHelpClick(e) {
        return e.preventDefault(), !1
    }

    function onEditServerNameClick(e) {
        var page = dom.parentWithClass(this, "page");
        return require(["prompt"], function(prompt) {
            prompt({
                label: Globalize.translate("LabelFriendlyServerName"),
                description: Globalize.translate("LabelFriendlyServerNameHelp"),
                value: page.querySelector(".serverNameHeader").innerHTML,
                confirmText: Globalize.translate("ButtonSave")
            }).then(function(value) {
                loading.show(), ApiClient.getServerConfiguration().then(function(config) {
                    config.ServerName = value, ApiClient.updateServerConfiguration(config).then(function() {
                        page.querySelector(".serverNameHeader").innerHTML = value, loading.hide()
                    })
                })
            })
        }), e.preventDefault(), !1
    }
    window.DashboardPage = {
            newsStartIndex: 0,
            onPageInit: function() {
                var page = this;
                page.querySelector(".btnConnectionHelp").addEventListener("click", onConnectionHelpClick), page.querySelector(".btnEditServerName").addEventListener("click", onEditServerNameClick)
            },
            onPageShow: function() {
                var page = this,
                    apiClient = ApiClient;
                apiClient && (DashboardPage.newsStartIndex = 0, loading.show(), DashboardPage.pollForInfo(page), DashboardPage.startInterval(apiClient), Events.on(apiClient, "websocketmessage", DashboardPage.onWebSocketMessage), Events.on(apiClient, "websocketopen", DashboardPage.onWebSocketOpen), DashboardPage.lastAppUpdateCheck = null, DashboardPage.lastPluginUpdateCheck = null, DashboardPage.reloadSystemInfo(page), DashboardPage.reloadNews(page), DashboardPage.sessionUpdateTimer = setInterval(DashboardPage.refreshSessionsLocally, 6e4), $(".activityItems", page).activityLogList(), $(".swaggerLink", page).attr("href", apiClient.getUrl("swagger-ui/index.html", {
                    api_key: ApiClient.accessToken()
                })), refreshHealthMonitor(page))
            },
            onPageHide: function() {
                var page = this;
                $(".activityItems", page).activityLogList("destroy");
                var apiClient = ApiClient;
                apiClient && (Events.off(apiClient, "websocketmessage", DashboardPage.onWebSocketMessage), Events.off(apiClient, "websocketopen", DashboardPage.onWebSocketOpen), DashboardPage.stopInterval(apiClient)), DashboardPage.sessionUpdateTimer && clearInterval(DashboardPage.sessionUpdateTimer)
            },
            renderPaths: function(page, systemInfo) {
                $("#cachePath", page).html(systemInfo.CachePath), $("#logPath", page).html(systemInfo.LogPath), $("#transcodingTemporaryPath", page).html(systemInfo.TranscodingTempPath), $("#metadataPath", page).html(systemInfo.InternalMetadataPath)
            },
            refreshSessionsLocally: function() {
                var list = DashboardPage.sessionsList;
                list && DashboardPage.renderActiveConnections($.mobile.activePage, list)
            },
            reloadSystemInfo: function(page) {
                ApiClient.getSystemInfo().then(function(systemInfo) {
                    page.querySelector(".serverNameHeader").innerHTML = systemInfo.ServerName;
                    var localizedVersion = Globalize.translate("LabelVersionNumber", systemInfo.Version);
                    systemInfo.SystemUpdateLevel && "Release" != systemInfo.SystemUpdateLevel && (localizedVersion += " " + Globalize.translate("Option" + systemInfo.SystemUpdateLevel).toLowerCase()), $("#appVersionNumber", page).html(localizedVersion), systemInfo.SupportsHttps ? $("#ports", page).html(Globalize.translate("LabelRunningOnPorts", systemInfo.HttpServerPortNumber, systemInfo.HttpsPortNumber)) : $("#ports", page).html(Globalize.translate("LabelRunningOnPort", systemInfo.HttpServerPortNumber)), systemInfo.CanSelfRestart ? $(".btnRestartContainer", page).removeClass("hide") : $(".btnRestartContainer", page).addClass("hide"), DashboardPage.renderUrls(page, systemInfo), DashboardPage.renderPendingInstallations(page, systemInfo), systemInfo.CanSelfUpdate ? ($("#btnUpdateApplicationContainer", page).show(), $("#btnManualUpdateContainer", page).hide()) : ($("#btnUpdateApplicationContainer", page).hide(), $("#btnManualUpdateContainer", page).show()), "synology" == systemInfo.PackageName ? $("#btnManualUpdateContainer").html(Globalize.translate("SynologyUpdateInstructions")) : $("#btnManualUpdateContainer").html('<a href="http://emby.media/download" target="_blank">' + Globalize.translate("PleaseUpdateManually") + "</a>"), DashboardPage.renderPaths(page, systemInfo), DashboardPage.renderHasPendingRestart(page, systemInfo.HasPendingRestart)
                })
            },
            reloadNews: function(page) {
                var query = {
                    StartIndex: DashboardPage.newsStartIndex,
                    Limit: 7
                };
                ApiClient.getProductNews(query).then(function(result) {
                    var html = result.Items.map(function(item) {
                            var itemHtml = "";
                            itemHtml += '<a class="clearLink" href="' + item.Link + '" target="_blank">', itemHtml += '<div class="listItem listItem-noborder">', itemHtml += '<i class="listItemIcon md-icon">dvr</i>', itemHtml += '<div class="listItemBody two-line">', itemHtml += '<div class="listItemBodyText">', itemHtml += item.Title, itemHtml += "</div>", itemHtml += '<div class="listItemBodyText secondary">';
                            var date = datetime.parseISO8601Date(item.Date, !0);
                            return itemHtml += datetime.toLocaleDateString(date), itemHtml += "</div>", itemHtml += "</div>", itemHtml += "</div>", itemHtml += "</a>"
                        }),
                        pagingHtml = "";
                    pagingHtml += "<div>", pagingHtml += LibraryBrowser.getQueryPagingHtml({
                        startIndex: query.StartIndex,
                        limit: query.Limit,
                        totalRecordCount: result.TotalRecordCount,
                        showLimit: !1,
                        updatePageSizeSetting: !1
                    }), pagingHtml += "</div>", html = html.join("") + pagingHtml;
                    var elem = $(".latestNewsItems", page).html(html);
                    $(".btnNextPage", elem).on("click", function() {
                        DashboardPage.newsStartIndex += query.Limit, DashboardPage.reloadNews(page)
                    }), $(".btnPreviousPage", elem).on("click", function() {
                        DashboardPage.newsStartIndex -= query.Limit, DashboardPage.reloadNews(page)
                    })
                })
            },
            startInterval: function(apiClient) {
                apiClient.isWebSocketOpen() && (apiClient.sendWebSocketMessage("SessionsStart", "0,1500"), apiClient.sendWebSocketMessage("ScheduledTasksInfoStart", "0,1000"))
            },
            stopInterval: function(apiClient) {
                apiClient.isWebSocketOpen() && (apiClient.sendWebSocketMessage("SessionsStop"), apiClient.sendWebSocketMessage("ScheduledTasksInfoStop"))
            },
            onWebSocketMessage: function(e, msg) {
                var page = $.mobile.activePage;
                if ("Sessions" == msg.MessageType) DashboardPage.renderInfo(page, msg.Data);
                else if ("RestartRequired" == msg.MessageType) DashboardPage.renderHasPendingRestart(page, !0);
                else if ("ServerShuttingDown" == msg.MessageType) DashboardPage.renderHasPendingRestart(page, !0);
                else if ("ServerRestarting" == msg.MessageType) DashboardPage.renderHasPendingRestart(page, !0);
                else if ("ScheduledTasksInfo" == msg.MessageType) {
                    var tasks = msg.Data;
                    DashboardPage.renderRunningTasks(page, tasks)
                } else "PackageInstalling" != msg.MessageType && "PackageInstallationCompleted" != msg.MessageType || (DashboardPage.pollForInfo(page, !0), DashboardPage.reloadSystemInfo(page))
            },
            onWebSocketOpen: function() {
                var apiClient = this;
                DashboardPage.startInterval(apiClient)
            },
            pollForInfo: function(page, forceUpdate) {
                var apiClient = window.ApiClient;
                apiClient && (apiClient.getSessions().then(function(sessions) {
                    DashboardPage.renderInfo(page, sessions, forceUpdate)
                }), apiClient.getScheduledTasks().then(function(tasks) {
                    DashboardPage.renderRunningTasks(page, tasks)
                }))
            },
            renderInfo: function(page, sessions, forceUpdate) {
                DashboardPage.renderActiveConnections(page, sessions), DashboardPage.renderPluginUpdateInfo(page, forceUpdate), loading.hide()
            },
            renderActiveConnections: function(page, sessions) {
                var html = "";
                DashboardPage.sessionsList = sessions;
                var parentElement = $(".activeDevices", page);
                $(".card", parentElement).addClass("deadSession");
                for (var i = 0, length = sessions.length; i < length; i++) {
                    var session = sessions[i],
                        rowId = "session" + session.Id,
                        elem = $("#" + rowId, page);
                    if (elem.length) DashboardPage.updateSession(elem, session);
                    else {
                        var nowPlayingItem = session.NowPlayingItem,
                            className = "scalableCard card activeSession backdropCard backdropCard-scalable";
                        session.TranscodingInfo && session.TranscodingInfo.CompletionPercentage && (className += " transcodingSession"), html += '<div class="' + className + '" id="' + rowId + '">', html += '<div class="cardBox visualCardBox">', html += '<div class="cardScalable visualCardBox-cardScalable">', html += '<div class="cardPadder cardPadder-backdrop"></div>', html += '<div class="cardContent">', html += '<div class="sessionNowPlayingContent"';
                        var imgUrl = DashboardPage.getNowPlayingImageUrl(nowPlayingItem);
                        imgUrl && (html += ' data-src="' + imgUrl + '" style="display:inline-block;background-image:url(\'' + imgUrl + "');\""), html += "></div>", html += '<div class="sessionNowPlayingInnerContent">', html += '<div class="sessionAppInfo">';
                        var clientImage = DashboardPage.getClientImage(session);
                        clientImage && (html += clientImage), html += '<div class="sessionAppName" style="display:inline-block;">', html += '<div class="sessionDeviceName">' + session.DeviceName + "</div>", html += '<div class="sessionAppSecondaryText">' + DashboardPage.getAppSecondaryText(session) + "</div>", html += "</div>", html += "</div>", html += '<div class="sessionNowPlayingTime">' + DashboardPage.getSessionNowPlayingTime(session) + "</div>";
                        var nowPlayingName = DashboardPage.getNowPlayingName(session);
                        if (html += '<div class="sessionNowPlayingInfo" data-imgsrc="' + nowPlayingName.image + '">', html += nowPlayingName.html, html += "</div>", nowPlayingItem && nowPlayingItem.RunTimeTicks) {
                            var position = session.PlayState.PositionTicks || 0,
                                value = 100 * position / nowPlayingItem.RunTimeTicks;
                            html += '<progress class="playbackProgress" min="0" max="100" value="' + value + '"></progress>'
                        } else html += '<progress class="playbackProgress" min="0" max="100" style="display:none;"></progress>';
                        html += session.TranscodingInfo && session.TranscodingInfo.CompletionPercentage ? '<progress class="transcodingProgress" min="0" max="100" value="' + session.TranscodingInfo.CompletionPercentage.toFixed(1) + '"></progress>' : '<progress class="transcodingProgress" min="0" max="100" style="display:none;"></progress>', html += "</div>", html += "</div>", html += "</div>", html += '<div style="padding:1em;border-top:1px solid #eee;background:#fff;text-align:center;">', html += '<div class="sessionNowPlayingStreamInfo" style="padding:0 0 1em;">', html += DashboardPage.getSessionNowPlayingStreamInfo(session), html += "</div>", html += '<div style="display:flex;align-items:center;justify-content:center;text-transform:uppercase;">';
                        var userImage = DashboardPage.getUserImage(session);
                        html += userImage ? '<img style="height:24px;border-radius:50px;margin-right:.5em;" src="' + userImage + '" />' : '<div style="height:24px;"></div>', html += '<div class="sessionUserName">', html += DashboardPage.getUsersHtml(session) || "&nbsp;", html += "</div>", html += "</div>", html += "</div>", html += "</div>", html += "</div>"
                    }
                }
                parentElement.append(html), $(".deadSession", parentElement).remove()
            },
            getSessionNowPlayingStreamInfo: function(session) {
                var html = "",
                    showTranscodingInfo = !1;
                if (session.TranscodingInfo && session.TranscodingInfo.IsAudioDirect && session.TranscodingInfo.IsVideoDirect ? html += Globalize.translate("LabelPlayMethodDirectStream") : session.TranscodingInfo && session.TranscodingInfo.IsVideoDirect ? html += Globalize.translate("LabelPlayMethodDirectStream") : "Transcode" == session.PlayState.PlayMethod ? (html += Globalize.translate("LabelPlayMethodTranscoding"), session.TranscodingInfo && session.TranscodingInfo.Framerate && (html += " (" + session.TranscodingInfo.Framerate + " fps)"), showTranscodingInfo = !0) : "DirectStream" == session.PlayState.PlayMethod ? html += Globalize.translate("LabelPlayMethodDirectPlay") : "DirectPlay" == session.PlayState.PlayMethod && (html += Globalize.translate("LabelPlayMethodDirectPlay")), showTranscodingInfo) {
                    var line = [];
                    session.TranscodingInfo && (session.TranscodingInfo.Bitrate && (session.TranscodingInfo.Bitrate > 1e6 ? line.push((session.TranscodingInfo.Bitrate / 1e6).toFixed(1) + " Mbps") : line.push(Math.floor(session.TranscodingInfo.Bitrate / 1e3) + " kbps")), session.TranscodingInfo.Container && line.push(session.TranscodingInfo.Container), session.TranscodingInfo.VideoCodec && line.push(session.TranscodingInfo.VideoCodec), session.TranscodingInfo.AudioCodec && session.TranscodingInfo.AudioCodec != session.TranscodingInfo.Container && line.push(session.TranscodingInfo.AudioCodec)), line.length && (html += " - " + line.join(" "))
                }
                return html || "&nbsp;"
            },
            getSessionNowPlayingTime: function(session) {
                var html = "";
                html += session.PlayState.PositionTicks ? datetime.getDisplayRunningTime(session.PlayState.PositionTicks) : "--:--:--", html += " / ";
                var nowPlayingItem = session.NowPlayingItem;
                return html += nowPlayingItem && nowPlayingItem.RunTimeTicks ? datetime.getDisplayRunningTime(nowPlayingItem.RunTimeTicks) : "--:--:--"
            },
            getAppSecondaryText: function(session) {
                return session.Client + " " + session.ApplicationVersion
            },
            getNowPlayingName: function(session) {
                var imgUrl = "",
                    nowPlayingItem = session.NowPlayingItem;
                if (!nowPlayingItem) return {
                    html: "Last seen " + humane_date(session.LastActivityDate),
                    image: imgUrl
                };
                var topText = nowPlayingItem.Name,
                    bottomText = "";
                nowPlayingItem.Artists && nowPlayingItem.Artists.length ? (bottomText = topText, topText = nowPlayingItem.Artists[0]) : nowPlayingItem.SeriesName || nowPlayingItem.Album ? (bottomText = topText, topText = nowPlayingItem.SeriesName || nowPlayingItem.Album) : nowPlayingItem.ProductionYear && (bottomText = nowPlayingItem.ProductionYear), nowPlayingItem.LogoItemId && (imgUrl = ApiClient.getScaledImageUrl(nowPlayingItem.LogoItemId, {
                    tag: session.LogoImageTag,
                    maxHeight: 24,
                    maxWidth: 130,
                    type: "Logo"
                }), topText = '<img src="' + imgUrl + '" style="max-height:24px;max-width:130px;" />');
                var text = bottomText ? topText + "<br/>" + bottomText : topText;
                return {
                    html: text,
                    image: imgUrl
                }
            },
            getUsersHtml: function(session) {
                var html = [];
                session.UserId && html.push(session.UserName);
                for (var i = 0, length = session.AdditionalUsers.length; i < length; i++) html.push(session.AdditionalUsers[i].UserName);
                return html.join(", ")
            },
            getUserImage: function(session) {
                return session.UserId && session.UserPrimaryImageTag ? ApiClient.getUserImageUrl(session.UserId, {
                    tag: session.UserPrimaryImageTag,
                    height: 24,
                    type: "Primary"
                }) : null
            },
            updateSession: function(row, session) {
                row.removeClass("deadSession");
                var nowPlayingItem = session.NowPlayingItem;
                nowPlayingItem ? row.addClass("playingSession") : row.removeClass("playingSession"), $(".sessionNowPlayingStreamInfo", row).html(DashboardPage.getSessionNowPlayingStreamInfo(session)), $(".sessionNowPlayingTime", row).html(DashboardPage.getSessionNowPlayingTime(session)), $(".sessionUserName", row).html(DashboardPage.getUsersHtml(session) || "&nbsp;"), $(".sessionAppSecondaryText", row).html(DashboardPage.getAppSecondaryText(session)), $(".sessionTranscodingFramerate", row).html(session.TranscodingInfo && session.TranscodingInfo.Framerate ? session.TranscodingInfo.Framerate + " fps" : "");
                var nowPlayingName = DashboardPage.getNowPlayingName(session),
                    nowPlayingInfoElem = $(".sessionNowPlayingInfo", row);
                if (nowPlayingName.image && nowPlayingName.image == nowPlayingInfoElem.attr("data-imgsrc") || (nowPlayingInfoElem.html(nowPlayingName.html), nowPlayingInfoElem.attr("data-imgsrc", nowPlayingName.image || "")), nowPlayingItem && nowPlayingItem.RunTimeTicks) {
                    var position = session.PlayState.PositionTicks || 0,
                        value = 100 * position / nowPlayingItem.RunTimeTicks;
                    $(".playbackProgress", row).show().val(value)
                } else $(".playbackProgress", row).hide();
                session.TranscodingInfo && session.TranscodingInfo.CompletionPercentage ? (row.addClass("transcodingSession"), $(".transcodingProgress", row).show().val(session.TranscodingInfo.CompletionPercentage)) : ($(".transcodingProgress", row).hide(), row.removeClass("transcodingSession"));
                var imgUrl = DashboardPage.getNowPlayingImageUrl(nowPlayingItem) || "",
                    imgElem = $(".sessionNowPlayingContent", row)[0];
                imgUrl != imgElem.getAttribute("data-src") && (imgElem.style.backgroundImage = imgUrl ? "url('" + imgUrl + "')" : "", imgElem.setAttribute("data-src", imgUrl))
            },
            getClientImage: function(connection) {
                var clientLowered = connection.Client.toLowerCase(),
                    device = connection.DeviceName.toLowerCase();
                if (connection.AppIconUrl) return "<img src='" + connection.AppIconUrl + "' />";
                if ("dashboard" == clientLowered || "emby web client" == clientLowered) {
                    var imgUrl;
                    return imgUrl = device.indexOf("chrome") != -1 ? "css/images/clients/chrome.png" : "css/images/clients/html5.png", "<img src='" + imgUrl + "' alt='Emby Web Client' />"
                }
                return clientLowered.indexOf("android") != -1 ? "<img src='css/images/clients/android.png' />" : clientLowered.indexOf("ios") != -1 ? "<img src='css/images/clients/ios.png' />" : "mb-classic" == clientLowered ? "<img src='css/images/clients/mbc.png' />" : "roku" == clientLowered ? "<img src='css/images/clients/roku.jpg' />" : "dlna" == clientLowered ? "<img src='css/images/clients/dlna.png' />" : "kodi" == clientLowered || "xbmc" == clientLowered ? "<img src='css/images/clients/kodi.png' />" : "chromecast" == clientLowered ? "<img src='css/images/clients/chromecast.png' />" : null
            },
            getNowPlayingImageUrl: function(item) {
                return item && item.BackdropImageTag ? ApiClient.getScaledImageUrl(item.BackdropItemId, {
                    type: "Backdrop",
                    width: 275,
                    tag: item.BackdropImageTag
                }) : item && item.ThumbImageTag ? ApiClient.getScaledImageUrl(item.ThumbItemId, {
                    type: "Thumb",
                    width: 275,
                    tag: item.ThumbImageTag
                }) : item && item.PrimaryImageTag ? ApiClient.getScaledImageUrl(item.PrimaryImageItemId, {
                    type: "Primary",
                    width: 275,
                    tag: item.PrimaryImageTag
                }) : null
            },
            systemUpdateTaskKey: "SystemUpdateTask",
            renderRunningTasks: function(page, tasks) {
                var html = "";
                tasks = tasks.filter(function(t) {
                    return "Idle" != t.State && !t.IsHidden
                }), tasks.filter(function(t) {
                    return t.Key == DashboardPage.systemUpdateTaskKey
                }).length ? $("#btnUpdateApplication", page).buttonEnabled(!1) : $("#btnUpdateApplication", page).buttonEnabled(!0), tasks.length ? $("#runningTasksCollapsible", page).show() : $("#runningTasksCollapsible", page).hide();
                for (var i = 0, length = tasks.length; i < length; i++) {
                    var task = tasks[i];
                    if (html += "<p>", html += task.Name + "<br/>", "Running" == task.State) {
                        var progress = (task.CurrentProgressPercentage || 0).toFixed(1);
                        html += '<progress max="100" value="' + progress + '" title="' + progress + '%">', html += "" + progress + "%", html += "</progress>", html += "<span style='color:#009F00;margin-left:5px;margin-right:5px;'>" + progress + "%</span>", html += '<button type="button" is="paper-icon-button-light" title="' + Globalize.translate("ButtonStop") + '" onclick="DashboardPage.stopTask(\'' + task.Id + '\');" class="autoSize"><i class="md-icon">cancel</i></button>'
                    } else "Cancelling" == task.State && (html += '<span style="color:#cc0000;">' + Globalize.translate("LabelStopping") + "</span>");
                    html += "</p>"
                }
                $("#divRunningTasks", page).html(html)
            },
            renderUrls: function(page, systemInfo) {
                var helpButton = '<a href="https://github.com/MediaBrowser/Wiki/wiki/Connectivity" target="_blank" style="margin-left:1em;color:#fff;background:#52B54B;padding:.25em 1em;border-radius:.5em;">' + Globalize.translate("ButtonHelp") + "</a>";
                if (systemInfo.LocalAddress) {
                    var localAccessHtml = Globalize.translate("LabelLocalAccessUrl", '<a href="' + systemInfo.LocalAddress + '" target="_blank">' + systemInfo.LocalAddress + "</a>");
                    $(".localUrl", page).html(localAccessHtml + helpButton).show().trigger("create")
                } else $(".externalUrl", page).hide();
                if (systemInfo.WanAddress) {
                    var externalUrl = systemInfo.WanAddress,
                        remoteAccessHtml = Globalize.translate("LabelRemoteAccessUrl", '<a href="' + externalUrl + '" target="_blank">' + externalUrl + "</a>");
                    $(".externalUrl", page).html(remoteAccessHtml + helpButton).show().trigger("create")
                } else $(".externalUrl", page).hide()
            },
            renderHasPendingRestart: function(page, hasPendingRestart) {
                if (hasPendingRestart) page.querySelector("#pUpToDate").classList.add("hide"), $("#pUpdateNow", page).hide();
                else {
                    if (DashboardPage.lastAppUpdateCheck && (new Date).getTime() - DashboardPage.lastAppUpdateCheck < 18e5) return;
                    DashboardPage.lastAppUpdateCheck = (new Date).getTime(), ApiClient.getAvailableApplicationUpdate().then(function(packageInfo) {
                        var version = packageInfo[0];
                        version ? (page.querySelector("#pUpToDate").classList.add("hide"), $("#pUpdateNow", page).show(), $("#newVersionNumber", page).html(Globalize.translate("VersionXIsAvailableForDownload").replace("{0}", version.versionStr))) : (page.querySelector("#pUpToDate").classList.remove("hide"), $("#pUpdateNow", page).hide())
                    })
                }
            },
            renderPendingInstallations: function(page, systemInfo) {
                if (!systemInfo.CompletedInstallations.length) return void $("#collapsiblePendingInstallations", page).hide();
                $("#collapsiblePendingInstallations", page).show();
                for (var html = "", i = 0, length = systemInfo.CompletedInstallations.length; i < length; i++) {
                    var update = systemInfo.CompletedInstallations[i];
                    html += "<div><strong>" + update.Name + "</strong> (" + update.Version + ")</div>"
                }
                $("#pendingInstallations", page).html(html)
            },
            renderPluginUpdateInfo: function(page, forceUpdate) {
                !forceUpdate && DashboardPage.lastPluginUpdateCheck && (new Date).getTime() - DashboardPage.lastPluginUpdateCheck < 18e5 || (DashboardPage.lastPluginUpdateCheck = (new Date).getTime(), ApiClient.getAvailablePluginUpdates().then(function(updates) {
                    var elem = $("#pPluginUpdates", page);
                    if (!updates.length) return void elem.hide();
                    elem.show();
                    for (var html = "", i = 0, length = updates.length; i < length; i++) {
                        var update = updates[i];
                        html += "<p><strong>" + Globalize.translate("NewVersionOfSomethingAvailable").replace("{0}", update.name) + "</strong></p>", html += '<button type="button" is="emby-button" class="raised block" onclick="DashboardPage.installPluginUpdate(this);" data-name="' + update.name + '" data-guid="' + update.guid + '" data-version="' + update.versionStr + '" data-classification="' + update.classification + '">' + Globalize.translate("ButtonUpdateNow") + "</button>"
                    }
                    elem.html(html)
                }))
            },
            installPluginUpdate: function(button) {
                $(button).buttonEnabled(!1);
                var name = button.getAttribute("data-name"),
                    guid = button.getAttribute("data-guid"),
                    version = button.getAttribute("data-version"),
                    classification = button.getAttribute("data-classification");
                loading.show(), ApiClient.installPlugin(name, guid, classification, version).then(function() {
                    loading.hide()
                })
            },
            updateApplication: function() {
                var page = $.mobile.activePage;
                $("#btnUpdateApplication", page).buttonEnabled(!1), loading.show(), ApiClient.getScheduledTasks().then(function(tasks) {
                    var task = tasks.filter(function(t) {
                        return t.Key == DashboardPage.systemUpdateTaskKey
                    })[0];
                    ApiClient.startScheduledTask(task.Id).then(function() {
                        DashboardPage.pollForInfo(page), loading.hide()
                    })
                })
            },
            stopTask: function(id) {
                var page = $.mobile.activePage;
                ApiClient.stopScheduledTask(id).then(function() {
                    DashboardPage.pollForInfo(page)
                })
            },
            restart: function() {
                require(["confirm"], function(confirm) {
                    confirm({
                        title: Globalize.translate("HeaderRestart"),
                        text: Globalize.translate("MessageConfirmRestart"),
                        confirmText: Globalize.translate("ButtonRestart"),
                        primary: "cancel"
                    }).then(function() {
                        $("#btnRestartServer").buttonEnabled(!1), $("#btnShutdown").buttonEnabled(!1), Dashboard.restartServer()
                    })
                })
            },
            shutdown: function() {
                require(["confirm"], function(confirm) {
                    confirm({
                        title: Globalize.translate("HeaderShutdown"),
                        text: Globalize.translate("MessageConfirmShutdown"),
                        confirmText: Globalize.translate("ButtonShutdown"),
                        primary: "cancel"
                    }).then(function() {
                        $("#btnRestartServer").buttonEnabled(!1), $("#btnShutdown").buttonEnabled(!1), ApiClient.shutdownServer()
                    })
                })
            }
        }, $(document).on("pageinit", "#dashboardPage", DashboardPage.onPageInit).on("pageshow", "#dashboardPage", DashboardPage.onPageShow).on("pagebeforehide", "#dashboardPage", DashboardPage.onPageHide),
        function($, document, window) {
            function getEntryHtml(entry) {
                var html = "";
                html += '<div class="listItem listItem-noborder">';
                var color = "Error" == entry.Severity || "Fatal" == entry.Severity || "Warn" == entry.Severity ? "#cc0000" : "#52B54B";
                if (entry.UserId && entry.UserPrimaryImageTag) {
                    var userImgUrl = ApiClient.getUserImageUrl(entry.UserId, {
                        type: "Primary",
                        tag: entry.UserPrimaryImageTag,
                        height: 40
                    });
                    html += '<i class="listItemIcon md-icon" style="width:2em!important;height:2em!important;padding:0;color:transparent;background-color:' + color + ";background-image:url('" + userImgUrl + "');background-repeat:no-repeat;background-position:center center;background-size: cover;\">dvr</i>"
                } else html += '<i class="listItemIcon md-icon" style="background-color:' + color + '">dvr</i>';
                html += '<div class="listItemBody three-line">', html += '<div class="listItemBodyText">', html += entry.Name, html += "</div>", html += '<div class="listItemBodyText secondary">';
                var date = datetime.parseISO8601Date(entry.Date, !0);
                return html += datetime.toLocaleString(date).toLowerCase(), html += "</div>", html += '<div class="listItemBodyText secondary listItemBodyText-nowrap">', html += entry.ShortOverview || "", html += "</div>", html += "</div>", html += "</div>"
            }

            function renderList(elem, result, startIndex, limit) {
                var html = result.Items.map(getEntryHtml).join("");
                if (result.TotalRecordCount > limit) {
                    var query = {
                        StartIndex: startIndex,
                        Limit: limit
                    };
                    html += LibraryBrowser.getQueryPagingHtml({
                        startIndex: query.StartIndex,
                        limit: query.Limit,
                        totalRecordCount: result.TotalRecordCount,
                        showLimit: !1,
                        updatePageSizeSetting: !1
                    })
                }
                $(elem).html(html), $(".btnNextPage", elem).on("click", function() {
                    reloadData(elem, startIndex + limit, limit)
                }), $(".btnPreviousPage", elem).on("click", function() {
                    reloadData(elem, startIndex - limit, limit)
                }), $(".btnShowOverview", elem).on("click", function() {
                    var item = $(this).parents(".newsItem"),
                        overview = $(".newsItemLongDescription", item).html(),
                        name = $(".notificationName", item).html();
                    Dashboard.alert({
                        message: '<div style="max-height:300px; overflow: auto;">' + overview + "</div>",
                        title: name
                    })
                })
            }

            function reloadData(elem, startIndex, limit) {
                null == startIndex && (startIndex = parseInt(elem.getAttribute("data-activitystartindex") || "0")), limit = limit || parseInt(elem.getAttribute("data-activitylimit") || "7");
                var minDate = new Date;
                minDate.setTime(minDate.getTime() - 864e5), ApiClient.getJSON(ApiClient.getUrl("System/ActivityLog/Entries", {
                    startIndex: startIndex,
                    limit: limit,
                    minDate: minDate.toISOString()
                })).then(function(result) {
                    elem.setAttribute("data-activitystartindex", startIndex), elem.setAttribute("data-activitylimit", limit), renderList(elem, result, startIndex, limit)
                })
            }

            function createList(elem) {
                elem.each(function() {
                    reloadData(this)
                }).addClass("activityLogListWidget");
                var apiClient = ApiClient;
                apiClient && (Events.on(apiClient, "websocketopen", onSocketOpen), Events.on(apiClient, "websocketmessage", onSocketMessage))
            }

            function startListening(apiClient) {
                apiClient.isWebSocketOpen() && apiClient.sendWebSocketMessage("ActivityLogEntryStart", "0,1500")
            }

            function stopListening(apiClient) {
                apiClient.isWebSocketOpen() && apiClient.sendWebSocketMessage("ActivityLogEntryStop", "0,1500")
            }

            function onSocketOpen() {
                var apiClient = ApiClient;
                apiClient && startListening(apiClient)
            }

            function onSocketMessage(e, data) {
                var msg = data;
                "ActivityLogEntry" === msg.MessageType && $(".activityLogListWidget").each(function() {
                    reloadData(this)
                })
            }

            function destroyList(elem) {
                var apiClient = ApiClient;
                apiClient && (Events.off(apiClient, "websocketopen", onSocketOpen), Events.off(apiClient, "websocketmessage", onSocketMessage), stopListening(apiClient))
            }
            $.fn.activityLogList = function(action) {
                "destroy" == action ? (this.removeClass("activityLogListWidget"), destroyList(this)) : createList(this);
                var apiClient = ApiClient;
                return apiClient && startListening(apiClient), this
            }
        }(jQuery, document, window),
        function($, document, window) {
            function dismissWelcome(page, userId) {
                ApiClient.getDisplayPreferences("dashboard", userId, "dashboard").then(function(result) {
                    result.CustomPrefs[welcomeTourKey] = welcomeDismissValue, ApiClient.updateDisplayPreferences("dashboard", result, userId, "dashboard"), $(page).off("pageshow", onPageShowCheckTour)
                })
            }

            function showWelcomeIfNeeded(page, apiClient) {
                var userId = Dashboard.getCurrentUserId();
                apiClient.getDisplayPreferences("dashboard", userId, "dashboard").then(function(result) {
                    if (result.CustomPrefs[welcomeTourKey] == welcomeDismissValue) $(".welcomeMessage", page).hide();
                    else {
                        var elem = $(".welcomeMessage", page).show();
                        result.CustomPrefs[welcomeTourKey] ? ($(".tourHeader", elem).html(Globalize.translate("HeaderWelcomeBack")), $(".tourButtonText", elem).html(Globalize.translate("ButtonTakeTheTourToSeeWhatsNew"))) : ($(".tourHeader", elem).html(Globalize.translate("HeaderWelcomeToProjectServerDashboard")), $(".tourButtonText", elem).html(Globalize.translate("ButtonTakeTheTour")))
                    }
                })
            }

            function takeTour(page, userId) {
                require(["slideshow"], function() {
                    var slides = [{
                        imageUrl: "css/images/tour/admin/dashboard.png",
                        title: Globalize.translate("DashboardTourDashboard")
                    }, {
                        imageUrl: "css/images/tour/admin/help.png",
                        title: Globalize.translate("DashboardTourHelp")
                    }, {
                        imageUrl: "css/images/tour/admin/users.png",
                        title: Globalize.translate("DashboardTourUsers")
                    }, {
                        imageUrl: "css/images/tour/admin/sync.png",
                        title: Globalize.translate("DashboardTourSync")
                    }, {
                        imageUrl: "css/images/tour/admin/cinemamode.png",
                        title: Globalize.translate("DashboardTourCinemaMode")
                    }, {
                        imageUrl: "css/images/tour/admin/chapters.png",
                        title: Globalize.translate("DashboardTourChapters")
                    }, {
                        imageUrl: "css/images/tour/admin/subtitles.png",
                        title: Globalize.translate("DashboardTourSubtitles")
                    }, {
                        imageUrl: "css/images/tour/admin/plugins.png",
                        title: Globalize.translate("DashboardTourPlugins")
                    }, {
                        imageUrl: "css/images/tour/admin/notifications.png",
                        title: Globalize.translate("DashboardTourNotifications")
                    }, {
                        imageUrl: "css/images/tour/admin/scheduledtasks.png",
                        title: Globalize.translate("DashboardTourScheduledTasks")
                    }, {
                        imageUrl: "css/images/tour/admin/mobile.png",
                        title: Globalize.translate("DashboardTourMobile")
                    }, {
                        imageUrl: "css/images/tour/enjoy.jpg",
                        title: Globalize.translate("MessageEnjoyYourStay")
                    }];
                    require(["slideshow"], function(slideshow) {
                        var newSlideShow = new slideshow({
                            slides: slides,
                            interactive: !0,
                            loop: !1
                        });
                        newSlideShow.show(), dismissWelcome(page, userId), $(".welcomeMessage", page).hide()
                    })
                })
            }

            function onPageShowCheckTour() {
                var page = this,
                    apiClient = ApiClient;
                apiClient && !AppInfo.isNativeApp && showWelcomeIfNeeded(page, apiClient)
            }
            var welcomeDismissValue = "12",
                welcomeTourKey = "welcomeTour";
            $(document).on("pageinit", "#dashboardPage", function() {
                var page = this;
                $(".btnTakeTour", page).on("click", function() {
                    takeTour(page, Dashboard.getCurrentUserId())
                })
            }).on("pageshow", "#dashboardPage", onPageShowCheckTour)
        }(jQuery, document, window), pageClassOn("pageshow", "type-interior", function() {
            var page = this;
            Dashboard.getPluginSecurityInfo().then(function(pluginSecurityInfo) {
                if (!page.querySelector(".customSupporterPromotion") && ($(".supporterPromotion", page).remove(), !pluginSecurityInfo.IsMBSupporter && AppInfo.enableSupporterMembership)) {
                    var html = '<div class="supporterPromotionContainer"><div class="supporterPromotion"><a class="clearLink" href="http://emby.media/premiere" target="_blank"><button is="emby-button" type="button" class="raised block" style="text-transform:none;background-color:#52B54B;color:#fff;"><div>' + Globalize.translate("HeaderSupportTheTeam") + '</div><div style="font-weight:normal;margin-top:5px;">' + Globalize.translate("TextEnjoyBonusFeatures") + "</div></button></a></div></div>";
                    page.querySelector(".content-primary").insertAdjacentHTML("afterbegin", html)
                }
            })
        })
});
