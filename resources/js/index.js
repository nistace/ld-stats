$("#launch-btn").on("click", Init);
$("button.select-type").on("click", changeValueType);
$("#launch-name").on("change", fixName);
$("td[data-grade]").click(toggleCategory);

function toggleCategory() {
    if ($(this).hasClass("inactive")) {
        $(this).removeClass("inactive");
    } else {
        $(this).addClass("inactive");
    }
    refreshGraph();
}

String.prototype.trimToLength = function (m) {
    return (this.length > m)
        ? jQuery.trim(this).substring(0, m).split(" ").slice(0, -1).join(" ") + "..."
        : this;
};

function fixName() {
    $("#launch-name").val($("#launch-name").val().replaceAll(/[^a-zA-Z0-9\-]/g, ""))
}

function goToLD() {
    fixName();
    window.open(`https://ldjam.com/users/${$("#launch-name").val()}/games`, '_blank').focus();
}

$("button#goto-ld").on("click", goToLD);


let valueType = "relative-ranking";


function changeValueType() {
    valueType = $(this).data("type");
    $("button.select-type").removeClass("current");
    $(this).addClass("current");
    refreshAllValues();
    refreshGraph();
}


function Init() {
    fixName();
    valueType = $("button.select-type.current").data("type");
    $("#launch-name, #launch-btn").attr("disabled", "disabled");
    $("#table-rankings tbody").empty();
    $(".ct-chart").empty();
    $.get({url: `https://api.ldjam.com/vx/node2/walk/1/users/${$("#launch-name").val()}/games?node=&parent=&superparent=&author=`}).done(onUserDataReceived);
}

function onUserDataReceived(data) {
    if (data === undefined) {
        endSearch();
    } else {
        $.get({url: `https://api.ldjam.com/vx/node/feed/${data.node_id}/authors/item/game?limit=1000`}).done(onGameListReceived);
    }
}


function onGameListReceived(data) {
    if (data === undefined || data.feed.length == 0) {
        endSearch();
    } else {
        for (let i = 0; i < data.feed.length; ++i) {
            const newLine = $(`<tr data-id="${data.feed[i].id}"></tr>`);
            $("#table-rankings tbody").prepend(newLine);
            $(newLine).append($(`<td data-type="ld"></td>`));
            $(newLine).append($(`<td data-type="name"></td>`));
            for (let j = 1; j < 9; ++j) {
                $(newLine).append($(`<td data-type="grade-0${j}-result" class="number"></td>`));
            }
            $.get({url: `https://api.ldjam.com/vx/node2/get/${data.feed[i].id}`}).done(onGameDataReceived).fail(endSearch);
        }
    }
}


function onGameDataReceived(data) {
    let tr = $(`tr[data-id='${data.node[0].id}']`);
    $(tr).attr("data-event", data.node[0].parent);
    $.get({url: `https://api.ldjam.com/vx/node2/get/${data.node[0].parent}`}).done(onEventDataReceived).fail(endSearch);
    $(tr).find("td[data-type='name']").empty().append(data.node[0].name);
    for (let i = 1; i < 9; ++i) {
        let td = $(tr).find(`td[data-type='grade-0${i}-result']`);
        $(td).attr("data-ranking", data.node[0].magic[`grade-0${i}-result`])
        $(td).attr("data-score", data.node[0].magic[`grade-0${i}-average`]);
        $.get({url: `https://api.ldjam.com/vx/node/feed/${data.node[0].parent}/grade-0${i}-result+parent/item/game/${data.node[0].subsubtype}?limit=1`}).done(onGameCountReceived).fail(endSearch);
    }
    endSearch();
}


function onEventDataReceived(data) {
    const tr = $(`tr[data-event='${data.node[0].id}']`);
    $(tr).attr("data-ld", data.node[0].slug);
    $(tr).find("td[data-type='ld']").empty().append(data.node[0].slug);
    evalSelfRanking();
    refreshAllValues();
}

function onGameCountReceived(data) {
    let td = $(`tr[data-event='${data.root}'] td[data-type='${data.method[0]}']`);
    if (data.feed !== undefined && data.feed.length > 0) {
        $(td).attr("data-count", data.feed[0].score);
    }
    evalSelfRanking();
    refreshAllValues();
}


function refreshAllValues() {
    $("#table-rankings tbody td.number").each(function () {
        $(this).empty().append(getDisplayValue($(this)))
    });


    for (let i = 1; i < 9; ++i) {
        let best = undefined;
        let tds = $(`td[data-type='grade-0${i}-result']`);
        for (let j = 0; j < tds.length; ++j) {
            const tdValue = getCompareValue(tds[j], valueType);
            best = getBestValue(best, tdValue);
        }
        for (let j = 0; j < tds.length; ++j) {
            const tdValue = getCompareValue(tds[j], valueType);
            if (tdValue === best) $(tds[j]).addClass("best");
            else $(tds[j]).removeClass("best");
        }
    }

    refreshGraph();
}

function getBestValue(currentBest, other) {
    if (currentBest === undefined) return other;
    if (valueType === "absolute-ranking") return other < currentBest ? other : currentBest;
    if (valueType === "complete-ranking") return other < currentBest ? other : currentBest;
    if (valueType === "relative-ranking") return other < currentBest ? other : currentBest;
    if (valueType === "score") return other > currentBest ? other : currentBest;
    if (valueType === "self-ranking") return other < currentBest ? other : currentBest;
    return currentBest;
}

function getCompareValue(td, type) {
    if (type === "absolute-ranking") return isNaN($(td).data("ranking")) ? 99999 : $(td).data("ranking");
    if (type === "complete-ranking") return isNaN($(td).data("ranking")) ? 99999 : $(td).data("ranking") / $(td).data("count");
    if (type === "relative-ranking") return isNaN($(td).data("ranking")) ? 99999 : $(td).data("ranking") / $(td).data("count");
    if (type === "score") return isNaN($(td).data("score")) ? 0 : $(td).data("score");
    if (type === "self-ranking") return isNaN($(td).data("self-ranking")) || $(td).data("self-ranking") === -1 ? 99999 : $(td).data("self-ranking");
    return 99999;
}

function getDisplayValue(td) {
    if (isNaN($(td).data("ranking"))) return "-";
    if (valueType === "absolute-ranking") return isNaN($(td).data("ranking")) ? "-" : $(td).data("ranking");
    if (valueType === "complete-ranking") return isNaN($(td).data("ranking")) ? "-" : `${$(td).data("ranking")} / ${$(td).data("count")}`;
    if (valueType === "relative-ranking") return isNaN($(td).data("ranking")) ? "-" : (100 * $(td).data("ranking") / $(td).data("count")).toFixed(2);
    if (valueType === "score") return isNaN($(td).data("score")) ? "-" : $(td).data("score").toFixed(2);
    if (valueType === "self-ranking") return isNaN($(td).data("self-ranking")) || $(td).data("self-ranking") === -1 ? "-" : $(td).data("self-ranking");
    return "-";
}

function getNumberValue(td) {
    if (isNaN($(td).data("ranking"))) return "-";
    if (valueType === "absolute-ranking") return isNaN($(td).data("ranking")) ? "-" : $(td).data("ranking");
    if (valueType === "complete-ranking") return isNaN($(td).data("ranking")) ? "-" : (100 * $(td).data("ranking") / $(td).data("count")).toFixed(2);
    if (valueType === "relative-ranking") return isNaN($(td).data("ranking")) ? "-" : (100 * $(td).data("ranking") / $(td).data("count")).toFixed(2);
    if (valueType === "score") return isNaN($(td).data("score")) ? "-" : $(td).data("score").toFixed(2);
    if (valueType === "self-ranking") return isNaN($(td).data("self-ranking")) || $(td).data("self-ranking") === -1 ? "-" : $(td).data("self-ranking");
    return "-";
}


function getMaxValue() {
    if (valueType === "absolute-ranking") return undefined;
    if (valueType === "complete-ranking") return 100;
    if (valueType === "relative-ranking") return 100;
    if (valueType === "score") return 5;
    if (valueType === "self-ranking") return $("tr[data-ld]").length;
    return 100;
}

function getMinValue() {
    if (valueType === "absolute-ranking") return 0;
    if (valueType === "complete-ranking") return 0;
    if (valueType === "relative-ranking") return 0;
    if (valueType === "score") return 1;
    if (valueType === "self-ranking") return 1;
    return 100;
}


function evalSelfRanking() {
    for (let i = 1; i < 9; ++i) {
        let tds = $(`td[data-type='grade-0${i}-result']`);
        $(tds).data("self-ranking", -1);
        for (let ranking = 1; ranking <= tds.length; ++ranking) {
            let best = undefined;
            let bestTd = undefined;
            for (let j = 0; j < tds.length; ++j) {
                if ($(tds[j]).data('self-ranking') === -1) {
                    const tdValue = getCompareValue(tds[j], "relative-ranking");
                    best = getBestValue(best, tdValue);
                    if (tdValue === best) bestTd = tds[j];
                }
            }
            $(bestTd).data("self-ranking", ranking);
        }
    }
}

function endSearch() {
    $("#launch-name, #launch-btn").removeAttr("disabled");
}

function refreshGraph() {

    if ($("tr[data-ld]").length == 0) return;

    const labels = [];
    const series = [];

    $("tr[data-ld]").each(function (trIndex, trValue) {
        labels[trIndex] = `[${$(trValue).data("ld")}] ${$(trValue).find("td[data-type=name]").html().trimToLength(20)}`;
    });
    for (var i = 0; i < 8; ++i) {
        series[i] = [];
        if ($(`td.number[data-grade='${i + 1}']:not(.inactive)`).length > 0) {
            $("tr[data-ld]").each(function (index, value) {
                series[i][index] = getNumberValue($(value).find(`td[data-type='grade-0${i + 1}-result']`)[0]);
            });
        }
    }

    new Chartist.Line('.ct-chart',
        {
            labels: labels,
            series: series
        },
        {
            width: $("#table-rankings").width() - 4,
            height: $(window).height() - 106,
            high: getMaxValue(),
            low: getMinValue()
        }
    );
}