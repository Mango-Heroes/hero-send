import { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { Navbar } from '../components/navbar'
import { useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  LAMPORTS_PER_SOL,
  Transaction,
  PublicKey,
} from '@solana/web3.js'
import { gql, useQuery } from '@apollo/client'
import client from '../client'
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createTransferInstruction } from "@solana/spl-token";


const Home: NextPage = () => {
const { publicKey, signTransaction } = useWallet()
const { connection } = useConnection()

const massSend = async (list: Nft[], to: String) => {
  if (!list || !to || !connection|| !publicKey || !signTransaction) {
    console.log('returning')
     return
  }

  try { 
    new PublicKey(to)
    console.log("valid dest address: ", to)
  }catch(e: any){
    console.log("bad dest address")
    return
  }

  if (!list.length){
    console.log("probably want to select some nfts")
    return
  }

  const tx = new Transaction()
  for (var i = 0; i < list.length; i++){
  
    const mintPublicKey = new PublicKey(list[i].mintAddress); 
    const fromTokenAccount = await getAssociatedTokenAddress(mintPublicKey, publicKey)
    const fromPublicKey = publicKey
    const destPublicKey = new PublicKey(to);
    const destTokenAccount = await getAssociatedTokenAddress(mintPublicKey, destPublicKey)
    const receiverAccount = await connection.getAccountInfo(destTokenAccount)
    
    if (receiverAccount === null) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          fromPublicKey,
          destTokenAccount,
          destPublicKey,
          mintPublicKey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      )
    }

    tx.add(
      createTransferInstruction(
        fromTokenAccount,
        destTokenAccount,
        fromPublicKey,
        1
      )
    )
  }
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = publicKey

  let signed: Transaction | undefined = undefined

  try {
    signed = await signTransaction(tx)
  } catch (e: any) {
    console.log(e.message)
    return
  }

  let signature: string | undefined = undefined

  try {
    signature = await connection.sendRawTransaction(signed.serialize())

    await connection.confirmTransaction(signature, 'confirmed')
  }catch (e: any){
    console.log(e.message)
  }
}

const GET_NFTS = gql`
   query GetNfts(
    $owners: [PublicKey!]
    $limit: Int!
    $offset: Int!
   ){
     nfts(
      owners: $owners
      limit: $limit
      offset: $offset
     ){
      address
      mintAddress
      name
      description
      image
      owner {
        address
        associatedTokenAccountAddress
      }
     }
   }
`

interface Nft { 
  name: string
  address: string
  description: string
  image: string
  mintAddress: string
}

const [nfts, setNfts] = useState<Nft[]>([])
const [sending, setSending] = useState<Nft[]>([])
const [to, setTo] = useState("")

  useMemo(()=>{
    if (publicKey?.toBase58()){
      client.query({
        query: GET_NFTS,
        variables: {
          owners: [publicKey?.toBase58()],
          offset: 0,
          limit: 200,
        }
        
      })
      .then(res => setNfts(res.data.nfts))
    }else{
      setNfts([])
    }
  },[publicKey?.toBase58()])

  return (
    
    <div>
      <Head>
        <title>Create Next App</title>
        <meta name='description' content='Generated by create next app' />
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <Navbar />

      <div className='container'>
        
        <h1>Connected to: {publicKey?.toBase58()}</h1>
        <div className='grid grid-cols-2 gap-2'>
          <div>
          <ul>
          {nfts.map((e)=><li style={{"border": "solid 1px black", "marginTop": "10px"}}>{e.name}<button onClick={()=>setSending([...sending, e])} className='ml-10 text-white bg-blue-600'>Send it</button></li>)}
        </ul>
          </div>
          <div>
            <h2>To send</h2>
            <input type="text" className="" placeholder='pubkey address' onChange={(e)=>{setTo(e.target.value)}}/>
            <ul>{sending.map((e)=><li>{e.name}</li>)}</ul>
            <button onClick={()=>massSend(sending, to)} className="border border-black">Send them</button>
          </div>
        </div>
        
      </div>

      <footer></footer>
    </div>
  )
}

export default Home
