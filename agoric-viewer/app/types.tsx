type RoundData = {
    round: number,
    startedBy: string,
    startedAt: number,
    price: number,
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