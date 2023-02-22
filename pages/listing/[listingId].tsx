import { UserCircleIcon } from "@heroicons/react/24/solid";
import {
  MediaRenderer,
  useContract,
  useListing,
  useNetwork,
  useNetworkMismatch,
  useMakeBid,
  useOffers,
  useMakeOffer,
  useBuyNow,
  useAddress,
  useAcceptDirectListingOffer,
} from "@thirdweb-dev/react";
import { ListingType, NATIVE_TOKENS } from "@thirdweb-dev/sdk";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import Header from "../../components/Header";
import Countdown from "react-countdown";
import network from "../../utils/network";
import { ethers } from "ethers";

type Props = {};

const ListingPage = (props: Props) => {
  const address = useAddress();
  const router = useRouter();
  const [minimumNextBid, setMinimumNextBid] = useState<{
    displayValue: string;
    symbol: string;
  }>();
  const [bidAmount, setBidAmount] = useState("");

  const { listingId } = router.query as { listingId: string };

  const { contract } = useContract(
    process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT,
    "marketplace"
  ); // contract for marketplace

  const { data: offers } = useOffers(contract, listingId); // offers for nft
  const { mutate: buyNow } = useBuyNow(contract); // initialize buying option
  const { mutate: makeOffer } = useMakeOffer(contract); // initialize making offer option
  const { mutate: makeBid } = useMakeBid(contract); // initialize making bid option

  const networkMismatch = useNetworkMismatch();
  const [, switchNetwork] = useNetwork();

  const { data: listing, isLoading } = useListing(contract, listingId);

  useEffect(() => {
    if (!listingId || !contract || !listing) return;

    if (listing.type === ListingType.Auction) {
      fetchMinNextBid();
    }
  }, [listingId, listing, contract]);

  const formatPlaceholder = () => {
    if (!listing) return;
    if (listing.type === ListingType.Direct) {
      return "Enter Offer Amount";
    }
    if (listing.type === ListingType.Auction) {
      return Number(minimumNextBid?.displayValue) === 0
        ? "Enter Bid Amount"
        : `${minimumNextBid?.displayValue} ${minimumNextBid?.symbol} or more`;
    }
  };

  const fetchMinNextBid = async () => {
    if (!listingId || !contract) return;

    const minBidResponse = await contract.auction.getMinimumNextBid(listingId);

    setMinimumNextBid({
      displayValue: minBidResponse.displayValue,
      symbol: minBidResponse.symbol,
    });
  };

  const createBidOrOffer = async () => {
    try {
      if (networkMismatch) {
        switchNetwork && switchNetwork(network);
        return;
      }

      // Direct Listing
      if (listing?.type === ListingType.Direct) {
        if (
          listing.buyoutPrice.toString() ===
          ethers.utils.parseEther(bidAmount).toString()
        ) {
          console.log("Buyout Price met, buying NFT...");
          buyNft();
          return;
        }

        console.log("Buyout Price !NOT! met, making offer...");
        await makeOffer(
          {
            quantity: 1,
            listingId,
            pricePerToken: bidAmount,
          },
          {
            onSuccess(data, variables, context) {
              console.log("SUCCESS offer made", data);
              alert("NTF offer made successfully");
              setBidAmount("");
            },
            onError(error, variables, context) {
              console.log("ERROR", error, variables, context);
              alert("NTF make offer - ERROR");
            },
          }
        );
      }

      // Auction Listing
      if (listing?.type === ListingType.Auction) {
        console.log("Making Bid");

        await makeBid(
          {
            listingId,
            bid: bidAmount,
          },
          {
            onSuccess(data, variables, context) {
              console.log("SUCCESS bid made", data);
              alert("NTF bid made successfully");
              setBidAmount("");
            },
            onError(error, variables, context) {
              console.log("ERROR", error, variables, context);
              alert("NTF make bid - ERROR");
            },
          }
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  const buyNft = async () => {
    if (networkMismatch) {
      switchNetwork && switchNetwork(network);
      return;
    }

    if (!listingId || !contract || !listing) return;

    await buyNow(
      {
        id: listingId,
        buyAmount: 1,
        type: listing.type,
      },
      {
        onSuccess(data, variables, context) {
          console.log("SUCCESS", data);
          alert("NTF bought successfully");
          router.replace("/");
        },
        onError(error, variables, context) {
          console.log("ERROR", error, variables, context);
          alert("NTF buy - ERROR");
        },
      }
    );
  };

  const { mutate: acceptOffer } = useAcceptDirectListingOffer(contract);

  // Loader
  if (isLoading)
    return (
      <div>
        <Header />
        <div className="text-center animate-pulse text-blue-500">
          <p>Loading Item...</p>
        </div>
      </div>
    );

  // Error with listing
  if (!listing) {
    return <div>Listing not found!</div>;
  }

  // Actual page
  return (
    <div>
      <Header />

      <main className="max-w-6xl mx-auto p-2 flex flex-col lg:flex-row space-y-10 space-x-5 pr-10">
        <div className="p-10 border mx-auto lg:mx-0 max-w-md lg:max-w-xl">
          <MediaRenderer src={listing.asset.image} />
        </div>

        <section className="flex-1 space-y-5 pb-20 lg:pb-0">
          <div>
            <h1 className="text-xl font-bold">{listing.asset.name}</h1>
            <p className="text-gray-600">{listing.asset.description}</p>
            <p className="flex items-center text-xs sm:text-base">
              <UserCircleIcon className="h-5" />
              <span className="font-bold pr-2">Seller: </span>
              {listing.sellerAddress}
            </p>
          </div>

          <div className="grid grid-cols-2 items-center py-2">
            <p className="font-bold">Listing Type:</p>
            <p>
              {listing.type === ListingType.Direct
                ? "Direct Listing"
                : "Auction Listing"}
            </p>

            <p className="font-bold">Buy it Now Price: </p>
            <p className="text-4xl font-bold">
              {listing.buyoutCurrencyValuePerToken.displayValue}{" "}
              {listing.buyoutCurrencyValuePerToken.symbol}
            </p>

            <button
              onClick={buyNft}
              className="col-start-2 mt-2 bg-blue-600 font-bold
             text-white rounded-full w-44 py-4 px-10"
            >
              Buy Now
            </button>
          </div>
          {/* If direct, show offers here ... */}
          {listing.type === ListingType.Direct && offers && (
            <div className="grid grid-cols-2 gap-y-2">
              <p className="font-bold">Offers: </p>
              <p className="font-bold">
                {offers.length > 0 ? offers.length : 0}
              </p>

              {offers.map((offer) => (
                <>
                  <p className="flex items-center ml-5 text-sm italic">
                    <UserCircleIcon className="h-3 mr-2" />
                    {offer.offerer.slice(0, 5) +
                      "..." +
                      offer.offerer.slice(-5)}
                  </p>
                  <div>
                    <p
                      key={
                        offer.listingId +
                        offer.offerer +
                        offer.totalOfferAmount.toString()
                      }
                      className="text-sm italic"
                    >
                      {ethers.utils.formatEther(offer.totalOfferAmount)}{" "}
                      {NATIVE_TOKENS[network].symbol}
                    </p>

                    {listing.sellerAddress === address && (
                      <button
                        onClick={() => {
                          acceptOffer(
                            {
                              listingId,
                              addressOfOfferor: offer.offerer,
                            },
                            {
                              onSuccess(data, variables, context) {
                                console.log("SUCCESS", data);
                                alert("Accepted offer successfully");
                                router.replace("/");
                              },
                              onError(error, variables, context) {
                                console.log("ERROR", error, variables, context);
                                alert("Accepting offer - ERROR");
                              },
                            }
                          );
                        }}
                        className="p-2 w-32 bg-red-500/50 rounded-lg 
                      font-bold text-sm cursor-pointer"
                      >
                        Accept Offer
                      </button>
                    )}
                  </div>
                </>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 space-y-2 items-center justify-end">
            <hr className="col-span-2" />

            <p className="col-span-2 font-bold">
              {listing.type === ListingType.Direct
                ? "Make an Offer"
                : "Bid on this Auction"}
            </p>

            {listing.type === ListingType.Auction && (
              <>
                <p>Current Minimum Bid:</p>
                <p className="font-bold">
                  {minimumNextBid?.displayValue} {minimumNextBid?.symbol}
                </p>

                <p>Time Remaining:</p>
                <Countdown
                  date={Number(listing.endTimeInEpochSeconds.toString()) * 1000}
                />
              </>
            )}

            <input
              type="text"
              placeholder={formatPlaceholder()}
              className="border p-2 rounded-lg mr-5"
              onChange={(e) => setBidAmount(e.target.value)}
              value={bidAmount}
            />
            <button
              onClick={createBidOrOffer}
              className="bg-red-600 font-bold text-white rounded-full w-44 py-4 px-10"
            >
              {listing.type === ListingType.Direct ? "Offer" : "Bid"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ListingPage;
