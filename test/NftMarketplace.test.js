const { assert, expect, use } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace test", () => {
          let nftMarketplaceContract,
              nftMarketplace,
              basicNftContract,
              basicNft,
              deployer,
              user
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0
          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplaceContract = await ethers.getContract(
                  "NftMarketplace"
              )
              nftMarketplace = nftMarketplaceContract.connect(deployer)
              basicNftContract = await ethers.getContract("BasicNft")
              basicNft = basicNftContract.connect(deployer)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })
          describe("listItem", () => {
              it("Should emit an event after listing", async () => {
                  expect(
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                  ).to.emit("ItemListed")
              })
              it("Exclusively add items that are listed", async () => {
                  const error = `NftMarketplace__ItemAlreadyListed("${basicNft.address}", ${TOKEN_ID})`
                  await nftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })
              it("exclusively let the owner List", async () => {
                  nftMarketplace = nftMarketplaceContract.connect(user)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })
              it("needs approvals to list item", async function () {
                  nftMarketplace = await nftMarketplaceContract.connect(user)
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplaceContract.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                  ).to.be.revertedWith("NftMarketplace__MarketplaceNotApproved")
              })
              it("Updates listing Seller and price", async () => {
                  await nftMarketplace.listItem(
                      basicNft.address,
                      TOKEN_ID,
                      PRICE
                  )
                  const listing = await nftMarketplace.getListing(
                      basicNft.address,
                      TOKEN_ID
                  )
                  assert.equal(listing.price.toString(), PRICE)
                  assert.equal(listing.seller, deployer.address)
              })
              describe("cancelItem", () => {
                  it("Reverts when item is not listed", async () => {
                      await expect(
                          nftMarketplace.cancelListing(
                              basicNft.address,
                              TOKEN_ID
                          )
                      ).to.be.revertedWith("NftMarketplace__ItemNotListed")
                  })
                  it("reverts if anyone but the owner tries to call", async function () {
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                      nftMarketplace = nftMarketplaceContract.connect(user)
                      await expect(
                          nftMarketplace.cancelListing(
                              basicNft.address,
                              TOKEN_ID
                          )
                      ).to.be.revertedWith("NftMarketplace__NotOwner")
                  })
                  it("Emits an event when called and remove listing when called", async () => {
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                      expect(
                          await nftMarketplace.cancelListing(
                              basicNft.address,
                              TOKEN_ID
                          )
                      ).to.emit("ItemCancelled")
                      await expect(
                          nftMarketplace.cancelListing(
                              basicNft.address,
                              TOKEN_ID
                          )
                      ).to.be.revertedWith("NftMarketplace__ItemNotListed")
                  })
              })
              describe("buyItem", () => {
                  it("Revert if the item is not listed", async () => {
                      await expect(
                          nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                      ).to.be.revertedWith("NftMarketplace__ItemNotListed")
                  })
                  it("Reverts if the Price is not Met", async () => {
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                      await expect(
                          nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                      ).to.be.revertedWith("NftMarketplace__NotEnoughETHSent")
                  })
                  it("Transfers the NFT and updates the proceeds of the seller", async () => {
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                      nftMarketplace = nftMarketplaceContract.connect(user)
                      await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                      assert.equal(
                          await basicNft.ownerOf(TOKEN_ID),
                          user.address
                      )
                      const proceeds = await nftMarketplace.getProceeds(
                          deployer.address
                      )
                      assert.equal(proceeds.toString(), PRICE)
                  })
              })
              describe("updateListing", () => {
                  it("Reverts if the Item is not Listed", async () => {
                      await expect(
                          nftMarketplace.updateListing(
                              basicNft.address,
                              TOKEN_ID,
                              PRICE
                          )
                      ).to.be.revertedWith("NftMarketplace__ItemNotListed")
                  })
                  it("Reverts if anybody other that the owner calls it", async () => {
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                      nftMarketplace = nftMarketplaceContract.connect(user)
                      await expect(
                          nftMarketplace.updateListing(
                              basicNft.address,
                              TOKEN_ID,
                              PRICE + 1
                          )
                      ).to.be.revertedWith("NftMarketplace__NotOwner")
                  })
                  it("Updates the price", async () => {
                      const updatedPrice = ethers.utils.parseEther("0.2")
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                      await nftMarketplace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          updatedPrice
                      )
                      const listing = await nftMarketplace.getListing(
                          basicNft.address,
                          TOKEN_ID
                      )
                      assert.equal(
                          listing.price.toString(),
                          updatedPrice.toString()
                      )
                  })
                  it("Emits an event after Updating", async () => {
                      const updatedPrice = ethers.utils.parseEther("0.2")
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                      expect(
                          await nftMarketplace.updateListing(
                              basicNft.address,
                              TOKEN_ID,
                              updatedPrice
                          )
                      ).to.emit("ItemListed")
                  })
              })
              describe("withdrawProceeds", () => {
                  it("Reverts if proceeds is less than Zero", async () => {
                      await expect(
                          nftMarketplace.withdrawProceeds()
                      ).to.be.revertedWith("NftMarketplace__NoProceeds")
                  })
                  it("withdraws proceeds", async function () {
                      await nftMarketplace.listItem(
                          basicNft.address,
                          TOKEN_ID,
                          PRICE
                      )
                      nftMarketplace = nftMarketplaceContract.connect(user)
                      await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                      nftMarketplace = nftMarketplaceContract.connect(deployer)

                      const deployerProceedsBefore =
                          await nftMarketplace.getProceeds(deployer.address)
                      const deployerBalanceBefore = await deployer.getBalance()
                      const txResponse = await nftMarketplace.withdrawProceeds()
                      const transactionReceipt = await txResponse.wait(1)
                      const { gasUsed, effectiveGasPrice } = transactionReceipt
                      const gasCost = gasUsed.mul(effectiveGasPrice)
                      const deployerBalanceAfter = await deployer.getBalance()

                      assert(
                          deployerBalanceAfter.add(gasCost).toString() ==
                              deployerProceedsBefore
                                  .add(deployerBalanceBefore)
                                  .toString()
                      )
                  })
              })
          })
      })
