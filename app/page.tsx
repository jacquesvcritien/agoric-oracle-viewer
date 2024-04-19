"use client";
import { Link } from "@nextui-org/link";
import { Snippet } from "@nextui-org/snippet";
import { Code } from "@nextui-org/code"
import { button as buttonStyles } from "@nextui-org/theme";
import { siteConfig } from "@/config/site";
import { title, subtitle } from "@/components/primitives";
import { GithubIcon } from "@/components/icons";
import config from "./config/oracles.json"
import { useState, useEffect } from 'react'
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Spinner } from "@nextui-org/react";
import { Chip } from '@nextui-org/chip';
import { makeGetRequest, makePostRequest, parseAgoricFeedPriceResponse, parseAgoricFeedsResponse, parseAgoricInstancesResponse, parseAgoricRoundResponse, parseAgoricWalletResponse, sortSubmissionsByUnitPriceDesc } from "./helper";
import { Card, CardBody, CardHeader } from '@nextui-org/card';


export default function Home() {

	let oraclesConfig: Config = config as Config
	const [feeds, setFeeds] = useState<FeedDetails>({});
	const [oracleSubmissions, setOracleSubmissions] = useState<any>({});
	const [boardToPriceFeed, setBoardToPriceFeed] = useState<any>({});
	const [toastTitle, setToastTitle] = useState('');
	const [toastDesc, setToastDesc] = useState('');
	const [oracleInvitations, setOracleInvitations] = useState<any>({});
	const [selectedFeed, setSelectedFeed] = useState<string>("");

	useEffect(() => {
		setToastTitle("Getting data")
		setToastDesc("Please wait while we fetch the initial data")
		const url = config.rpc;
		let postData = {
			"jsonrpc": "2.0",
			"id": 1,
			"method": "abci_query",
			"params": {
				"path": "/custom/vstorage/children/published.priceFeed"
			}
		}

		// Get feeds
		makePostRequest(url, postData)
			.then(response => {
				let feedsResponse = parseAgoricFeedsResponse(response)
				if(feedsResponse){
					setOracleInvitations(feedsResponse?.oracleInvitations)
					setFeeds(feedsResponse?.feeds);
					console.log("Feeds", feedsResponse?.feeds)
				}
				
			})
			.catch(error => console.error('Error:', error));

		postData = {
			"jsonrpc": "2.0",
			"id": 1,
			"method": "abci_query",
			"params": {
				"path": "/custom/vstorage/data/published.agoricNames.instance",
			}
		}
		makePostRequest(url, postData)
			.then(response => {
				let boardToPriceFeed = parseAgoricInstancesResponse(response)
				setBoardToPriceFeed(boardToPriceFeed)
				setToastTitle("")
			})
			.catch(error => console.error('Error:', error));


	}, []);


	const getFeedDetails = async (feed: string) => {

		setToastTitle("Loading")
		setToastDesc("Getting data for "+feed)

		if (!(feed in oracleSubmissions)) {
			oracleSubmissions[feed] = {}
			setOracleSubmissions(oracleSubmissions)
		}
		console.log("Getting data for", feed)

		const url = config.rpc;
		let postData = {
			"jsonrpc": "2.0",
			"id": 1,
			"method": "abci_query",
			"params": {
				"path": "/custom/vstorage/data/published.priceFeed." + feed + "_price_feed.latestRound"
			}
		}

		let roundData = await makePostRequest(url, postData)
		let feedDetails = parseAgoricRoundResponse(roundData, feed, feeds)

		setSelectedFeed(feed)

		// Fill oracleSubmissions with feeds
		if (!(feedDetails[feed].round in oracleSubmissions[feed])) {
			oracleSubmissions[feed][feedDetails[feed].round] = {}
			setOracleSubmissions(oracleSubmissions)
		}

		postData = {
			"jsonrpc": "2.0",
			"id": 1,
			"method": "abci_query",
			"params": {
				"path": "/custom/vstorage/data/published.priceFeed." + feed + "_price_feed"
			}
		}

		let priceData = await makePostRequest(url, postData)
		feedDetails = parseAgoricFeedPriceResponse(priceData, feed, feedDetails)

		// Loop through each oracle
		for (let oracle in oraclesConfig.oracleAddresses) {

			let found = false;

			// Fill in remainder oracleSubmissions with oracles data
			if (!(oraclesConfig.oracleAddresses[oracle].oracleName in oracleSubmissions[feed][feedDetails[feed].round])) {
				oracleSubmissions[feed][feedDetails[feed].round][oraclesConfig.oracleAddresses[oracle].oracleName] = {}
				setOracleSubmissions(oracleSubmissions)
			}

			// Get current height
			let heightRequest = await makeGetRequest(url + "/block")
			let currentHeight = Number(heightRequest.result.block.header.height) - 1

			// Loop vstorage until responses for round by each oracle is found
			for (let height = currentHeight; !found; height--) {
				let postData = {
					"jsonrpc": "2.0",
					"id": 1,
					"method": "abci_query",
					"params": {
						"path": "/custom/vstorage/data/published.wallet." + oracle + ".current",
						"height": String(height)
					}
				}

				let wallet = await makePostRequest(url, postData)

				let walletInfo = parseAgoricWalletResponse(wallet, oracle, feed, feedDetails, oracleInvitations, boardToPriceFeed)

				setOracleInvitations(walletInfo.oracleInvitations)
				if(walletInfo.submission){
					found = true;

					if(walletInfo.submission.roundId != -1){
						oracleSubmissions[feed][walletInfo.submission.roundId][oraclesConfig.oracleAddresses[oracle].oracleName] = walletInfo.submission
						// Sort submissions in descending
						oracleSubmissions[feed][walletInfo.submission.roundId] = sortSubmissionsByUnitPriceDesc(oracleSubmissions[feed][walletInfo.submission.roundId])
						setOracleSubmissions(oracleSubmissions)
					}
				}
			}

		}

		console.log("oracle submissions", oracleSubmissions)
		
		setToastTitle("")
		setFeeds(feedDetails)

	}
	return (

		<section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
			{
				toastTitle.length > 0 ?
					<div className='toast rounded-xl'>
						<div className='flex mb-3'>
							<p>{toastTitle}</p>
							<Spinner className='m-auto ml-3' />
						</div>
						<p className='toastDesc'>{toastDesc}</p>
					</div> : null
			}
			<Card className="w-full">
				<CardHeader>
					<p className='text-2xl p-4'>Feeds</p>
				</CardHeader>
				<CardBody className='pb-10'>
					<div className="flex px-4">
						{Object.keys(feeds).map((key: any, index: any) => {
							return <Chip className="m mr-5 p-4 rounded-xl" color={key == selectedFeed ? "primary" : "default"} key={index} onClick={() => getFeedDetails(key)}>{key}</Chip>
						})}
					</div>

					{Object.keys(feeds).map((key: any, index: any) =>

						(selectedFeed == key && toastTitle.length == 0) ?
							<div key={key}>
								<div className="grid grid-cols-12 gap-4 pt-10">
									<div className="px-4 py-2 col-span-6">
										<p className="text-lg">Round</p>
										<p className="text-2xl">{feeds[key].round}</p>
									</div>
									<div className="px-4 py-2 col-span-6">
										<p className="text-lg">Price</p>
										<p className="text-2xl">${feeds[key].price.toFixed(2)}</p>
									</div>
									<div className="px-4 py-2 col-span-6">
										<p className="text-lg">Round Started At:</p>
										<p className="text-2xl">{new Date(feeds[key].startedAt * 1000).toUTCString()}</p>
									</div>
									<div className="px-4 py-2 col-span-6">
										<p className="text-lg">Round Started By:</p>
										<p className="text-2xl">{oraclesConfig.oracleAddresses[feeds[key].startedBy].oracleName}</p>
									</div>
								</div>

								<div>
									<Table aria-label="Submissions" className="pt-10">
										<TableHeader>
											<TableColumn>Oracle</TableColumn>
											<TableColumn>Submitted Price</TableColumn>
										</TableHeader>
										<TableBody>
											{
												Object.keys(oracleSubmissions[key][feeds[key].round]).map((oracle: any, index: any) =>
													(oracleSubmissions[key][feeds[key].round][oracle].unitPrice) ? <TableRow key={index}>
														<TableCell>{oracle}</TableCell>
														<TableCell>${oracleSubmissions[key][feeds[key].round][oracle].unitPrice}</TableCell>
													</TableRow> : <div className="hidden"></div>
												)
											}

										</TableBody>
									</Table>

								</div>
							</div> : null
					)}


				</CardBody>
			</Card>
			<Card className="w-full">
				<CardHeader>
					<p className='text-2xl p-4'>Oracles</p>
				</CardHeader>
				<CardBody className='pb-10'>
					<div className="px-4">
						{Object.keys(oraclesConfig.oracleAddresses).map((key: string, index: any) =>
							<div key={key} className="pb-5">
								<p className="text-primary ">{String(oraclesConfig.oracleAddresses[key].oracleName)}</p>
								<p className="text-zinc-300">{key}</p>
							</div>
						)}
					</div>

				</CardBody>
			</Card>
		</section>
	);
}
