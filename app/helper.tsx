import config from "./config/oracles.json"

let oraclesConfig: Config = config as Config
export const makePostRequest = async (url: string, data: any): Promise<any> => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

export const makeGetRequest = async (url: string): Promise<any> => {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

export const sortSubmissionsByUnitPriceDesc = (submissions: OracleSubmissions) => {
    // Convert object to array of key-value pairs
    const dataArray = Object.entries(submissions);

    // Sort the array based on the unitPrice property of inner objects
    dataArray.sort((a, b) => a[1].unitPrice - b[1].unitPrice);

    // Convert the sorted array back to an object if needed
    const sortedData = Object.fromEntries(dataArray);

    return sortedData
}

export const parseAgoricVStorageRes = (response: any) => {
    if (response.result.response.code != 0) {
        console.log("Query Errored")
        return null
    }

    return JSON.parse(atob(response.result.response.value))
}

export const parseAgoricFeedsResponse = (response: any) => {
    response = parseAgoricVStorageRes(response)

    if (!response) {
        return null
    }
    let feedsObtained = response.children
    let feedNames = feedsObtained.map((feed: string) => feed.split('_')[0])
    let feedDetails: FeedDetails = {}
    for (let feed of feedNames) {
        feedDetails[feed] = {
            round: 0,
            startedBy: "",
            startedAt: 0,
            price: 0,
            amountIn: 0
        };
    }

    let oracleInvitations: OracleInvitations = {}
    for (let oracle in oraclesConfig.oracleAddresses) {
        oracleInvitations[oracle] = {}
        for (let feed of feedNames) {
            oracleInvitations[oracle][feed] = ""
        }
    }

    return {
        feeds: feedDetails,
        oracleInvitations: oracleInvitations
    }
}

export const parseAgoricVStorageBody = (body: string) => {
    if (body.startsWith("#")) {
        return JSON.parse(body.substring(1, body.length))
    }

    return null
}

export const parseAgoricInstancesResponse = (response: any) => {
    response = parseAgoricVStorageRes(response)

    if (!response) {
        return null
    }
    let agoricNames = JSON.parse(response.value).values

    let boardToPriceFeed: BoardPriceFeeds = {}

    for (let agoricName of agoricNames) {
        agoricName = JSON.parse(agoricName)
        let body = parseAgoricVStorageBody(agoricName.body)
        let slots = agoricName.slots

        if (body) {
            for (let name of body) {
                if (name[0].includes("price feed")) {
                    let index = Number(name[1].split(".")[0].substring(1))
                    boardToPriceFeed[slots[index]] = name[0]
                }
            }
        }

    }

    return boardToPriceFeed

}

export const parseAgoricRoundResponse = (response: any, feed: string, feeds: FeedDetails) => {
    response = parseAgoricVStorageRes(response)

    if (!response) {
        return feeds
    }
    let roundData = JSON.parse(response.value).values

    for (let round of roundData) {
        round = JSON.parse(round)
        let body = parseAgoricVStorageBody(round.body)

        if (body) {
            feeds[feed] = {
                round: Number(body.roundId.substring(1, body.roundId.length)),
                startedAt: Number(body.startedAt.absValue.substring(1, body.startedAt.absValue.length)),
                startedBy: body.startedBy,
                price: 0,
                amountIn: 0
            }
        }

    }

    return feeds

}

export const parseAgoricFeedPriceResponse = (response: any, feed: string, feeds: FeedDetails) => {
    response = parseAgoricVStorageRes(response)

    if (!response) {
        return feeds
    }
    let priceData = JSON.parse(response.value).values

    for (let price of priceData) {
        price = JSON.parse(price)
        let body = parseAgoricVStorageBody(price.body)
        if (body) {
            const amountIn = Number(body.amountIn.value.substring(1, body.amountIn.value.length))
            const amountOut = Number(body.amountOut.value.substring(1, body.amountOut.value.length))
            feeds[feed].price = amountOut / amountIn
            feeds[feed].amountIn = amountIn
        }

    }

    return feeds

}

export const parseAgoricWalletResponse = (response: any, oracle: string, feed: string, feeds: FeedDetails, oracleInvitations: OracleInvitations, boardToPriceFeed: BoardPriceFeeds) => {
    response = parseAgoricVStorageRes(response)

    if (!response) {
        return {
            oracleInvitations: oracleInvitations,
            submission: null
        }
    }

    let oracleData = JSON.parse(response.value).values
    for (let data of oracleData) {
        data = JSON.parse(data)
        let slots = data.slots

        let body = parseAgoricVStorageBody(data.body)
        if (body) {
            let invitations = body.offerToUsedInvitation
            // if offer is not found
            if (oracleInvitations[oracle][feed] == "") {
                // Get accept ids with board
                for (let inv of invitations) {
                    let index = Number(inv[1].value[0].instance.split(".")[0].substring(1))

                    // Get price feed
                    let priceFeedName = boardToPriceFeed[slots[index]]
                    if (priceFeedName.startsWith(feed)) {
                        // Get current id
                        const currentId = Number(oracleInvitations[oracle][feed].split("oracleAccept-")[1])
                        const newId = Number(inv[0].split("oracleAccept-")[1])

                        if (oracleInvitations[oracle][feed] == "" || newId > currentId) {
                            oracleInvitations[oracle][feed] = inv[0]
                        }

                    }
                }

            }
            for (let liveOffer of body.liveOffers) {
                if (liveOffer[1].invitationSpec.invitationMakerName == "PushPrice") {
                    let id = Number(liveOffer[1].id)
                    let submission = {
                        roundId: liveOffer[1].invitationSpec.invitationArgs[0].roundId,
                        unitPrice: Number(liveOffer[1].invitationSpec.invitationArgs[0].unitPrice) / feeds[feed].amountIn
                    }

                    let previousOffer = liveOffer[1].invitationSpec.previousOffer

                    let expectedPreviousOffer = oracleInvitations[oracle][feed]


                    if (previousOffer == expectedPreviousOffer) {
                        return {
                            oracleInvitations: oracleInvitations,
                            submission: submission
                        }

                    }

                }
            }
        }

    }

    return {
        oracleInvitations: oracleInvitations,
        submission: null
    }

}

