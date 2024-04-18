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
import { Chip } from '@nextui-org/chip';
import { makePostRequest } from "./helper";
import { Card, CardBody, CardHeader } from '@nextui-org/card';


export default function Home() {

	let oraclesConfig: Config = config as Config
	const [feeds, setFeeds] = useState<any>({});
	const [selectedFeed, setSelectedFeed] = useState<string>("");

	useEffect(() => {
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
				let feedsObtained = JSON.parse(atob(response.result.response.value)).children
				let feedNames = feedsObtained.map((feed: string) => feed.split('_')[0])
				let feedDetails: any = {}
				for (let feed of feedNames) {
					feedDetails[feed] = {}
				}
				setFeeds(feedDetails);
				console.log("Feeds", feedDetails)
			})
			.catch(error => console.error('Error:', error));


		// Get each oracle
		for (let oracle in oraclesConfig.oracleAddresses){
			let postData = {
				"jsonrpc": "2.0",
				"id": 1,
				"method": "abci_query",
				"params": {
					"path": "/custom/vstorage/data/published.wallet."+oracle
				}
			}
	
			// Get feeds
			makePostRequest(url, postData)
				.then(response => {
					let oracleDetails = JSON.parse(atob(response.result.response.value))
					console.log("oracleDetails", oraclesConfig.oracleAddresses[oracle].oracleName, oracleDetails)
				})
				.catch(error => console.error('Error:', error));
		}
	}, []);


	const getFeedDetails = async (feed: string) => {
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
		roundData = JSON.parse(JSON.parse(atob(roundData.result.response.value)).value)
		console.log(roundData.blockHeight)
		let roundValues = roundData.values

		for (let roundValue of roundValues) {
			let body = JSON.parse(roundValue).body
			if (body.startsWith("#")) {
				body = JSON.parse(body.substring(1, body.length))
				feeds[feed] = {
					round: Number(body.roundId.substring(1, body.roundId.length)),
					startedAt: Number(body.startedAt.absValue.substring(1, body.startedAt.absValue.length)),
					startedBy: body.startedBy
				}
			}

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
		priceData = JSON.parse(JSON.parse(atob(priceData.result.response.value)).value)
		let priceValues = priceData.values

		for (let priceValue of priceValues) {
			let body = JSON.parse(priceValue).body
			let data = JSON.parse(priceValue)
			if (body.startsWith("#")) {
				body = JSON.parse(body.substring(1, body.length))
				const amountIn = Number(body.amountIn.value.substring(1, body.amountIn.value.length))
				const amountOut = Number(body.amountOut.value.substring(1, body.amountOut.value.length))
				feeds[feed].price = amountOut / amountIn
			}


		}

		setFeeds(feeds)
		setSelectedFeed(feed)

		console.log("Data for ", feeds[feed])

	}
	return (
		<section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
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

						(selectedFeed == key) ? 
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
								<p className="text-lg">Started At:</p>
								<p className="text-2xl">{feeds[key].startedAt}</p>
							</div>
							<div className="px-4 py-2 col-span-6">
								<p className="text-lg">Started By:</p>
								<p className="text-2xl">{feeds[key].startedBy}</p>
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
							<p className="text-primary">{String(oraclesConfig.oracleAddresses[key].oracleName)}</p>
							<p className="text-zinc-300">{key}</p>
							</div>
						)}
					</div>

				</CardBody>
			</Card>
		</section>
	);
}
