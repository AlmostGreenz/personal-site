"use strict";

// Favourite TV Show BarGraph Example:
const tvData = [
    {
        Show: "LOST",
        Count: 145,
        Img: "https://static.wikia.nocookie.net/lostpedia/images/a/ac/Lost-SeasonOneEdited.jpg"
    },
    {
        Show: "Sherlock",
        Count: 99,
        Img: "https://resizing.flixster.com/g8lv2hq9wqCD3gudbYa1_tTXAVA=/206x305/v2/https://flxt.tmsimg.com/assets/p8204516_b_v10_ao.jpg"
    },
    {
        Show: "Smallville",
        Count: 80,
        Img: "https://m.media-amazon.com/images/I/51oNKuccbGL._AC_.jpg"
    },
    {
        Show: "Hawkeye",
        Count: 66,
        Img: "https://lumiere-a.akamaihd.net/v1/images/p_disneyplusoriginals_hawkeye_poster_rebrand_22c56774.png"
    }
]

const tvTableDiv = document.querySelector('.tvTableDiv');

const favTVShow = new BarGraph("Favourite TV Show", tvData, "Count", "Show", tvTableDiv);
favTVShow.setMaxValueHonour(true); // set highest bar(s) as winner
favTVShow.setImages(null, 'Img'); // set images to be displayed on hover

// Win or Lose data ScatterPlot example
const winLoseData = [
    {
        Name: "Wipeout",
        Wins: 50,
        Losses: 80
    },
    {
        Name: "Visor",
        Wins: 30,
        Losses: 90
    },
    {
        Name: "Freeze",
        Wins: 5,
        Losses: 45
    },
    {
        Name: "Bowser",
        Wins: 15,
        Losses: 7
    }
]

const numWinLoseDiv = document.querySelector('.numWinLoseDiv');

const winLose = new ScatterPlot("Overwatch Win Rate 2021", winLoseData, "Wins", "Losses", numWinLoseDiv, 'Name');
winLose.setLegendVisibility(true);

/**
 * Add the specified data to the winLose ScatterPlot.
 * @param {event} e the user inputted show name
 */
function changeWinsPlotData(e) {
    e.preventDefault();
    const values = e.target.parentElement.querySelectorAll('input');

    winLose.addData([{
        Name: values[0].value,
        Wins: values[1].value,
        Losses: values[2].value
    }]);

    e.target.parentElement.parentElement.reset();
}

/**
 * Toggle the size of the dots in the winLose graph (between 20px and 5px)
 */
function changeDotSize(e) {
    e.preventDefault();

    const newSize = e.target.value;
    winLose.updateDotSize(newSize);
}

/**
 * Example function that changes graph sizing.
 * @param {event} e the user input (via range)
 * @param {_ScaledGraph} graph the graph to change the size of
 */
function changeGraphSize(e, graph) {
    const val = Number(e.target.value);

    graph.changeTableDimensions(300 + val, 200 + val);
    graph.outerDiv.parentElement.style.width = `${600 + val}px`;

    // adjust code display to fit graph size
    const codeDisplay = graph.outerDiv.parentElement.parentElement.querySelector('.codeDisplay');
    codeDisplay.style.maxHeight = `${375 + val * 1.1}px`;
}

// Bird watching data PieChart example
const birdWatchData = [
    {
        Count: 50,
        Name: "Sparrow"
    },
    {
        Count: 30,
        Name: "Falcon"
    },
    {
        Count: 5,
        Name: "Eagle"
    },
    {
        Count: 15,
        Name: "Robin"
    }
]

const pieChartDiv = document.querySelector('.pieChartDiv');

const pieChartExample = new PieChart("Bird Watching Data 2021", birdWatchData, "Count", "Name", pieChartDiv);

/**
 * Example function that changes graph sizing.
 * @param {event} e the user input (via range)
 * @param {PieChart} graph the graph to change the size of
 */
function changePieSize(e, graph) {
    const val = Number(e.target.value);

    graph.changeTableDimensions(300 + val);
    graph.outerDiv.parentElement.style.width = `${600 + val}px`;

    // adjust code display to fit graph size
    const codeDisplay = graph.outerDiv.parentElement.parentElement.querySelector('.codeDisplay');
    codeDisplay.style.maxHeight = `${375 + val * 1.1}px`;
}

/**
 * Add the specified data to the graph.
 * @param {event} e the user inputted show name
 * @param graph graph to be added to
 * @param {string} key the key that the identifying value can be found in
 */
function changeBarPieData(e, graph, key) {
    e.preventDefault();
    const value = e.target.previousElementSibling.value;
    const dataToAdd = [];
    let dataAdded = false;

    for (let element of graph.dataAlias) {
        if (element[key] === value) {
            element['Count']++;
            dataAdded = true;
            break;
        }
    }

    if (!dataAdded) {
        dataToAdd.push({
            [key]: value,
            Count: 1
        });
    }

    graph.addData(dataToAdd);
}

hljs.highlightAll(); // code highlighting provided by https://highlightjs.org
