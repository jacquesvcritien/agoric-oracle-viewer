type RoundData = {
    round: number,
    startedBy: string,
    startedAt: number,
    price: number,
    amountIn: number,
}

type FeedDetails = {
    [feed: string]: RoundData
}

type OracleInvitations = {
    [oracle: string]: {
        [feed: string] : string
    }
}

type OracleSubmissions = {
    [key: string]: Submission
}

type Submission = {
    roundId: number,
    unitPrice: number
}

type OraclesDetails = {
    [key: string]: OracleDetails
}

type OracleDetails = {
    oracleName: string
}
type Config = {
    rpc: string,
    oracleAddresses: OraclesDetails
}

type BoardPriceFeeds = {
    [board: string]: string
}