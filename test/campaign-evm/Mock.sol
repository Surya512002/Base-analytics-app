// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract MockToken {
    mapping(address=>uint256) public balanceOf; mapping(address=>mapping(address=>uint256)) public allowance;
    uint256 public feeBps;
    function mint(address t,uint256 a) external { balanceOf[t]+=a; }
    function setFee(uint256 b) external { feeBps=b; }
    function approve(address s,uint256 a) external returns(bool){ allowance[msg.sender][s]=a; return true; }
    function transfer(address t,uint256 a) external returns(bool){ balanceOf[msg.sender]-=a; balanceOf[t]+=a; return true; }
    function transferFrom(address f,address t,uint256 a) external returns(bool){ allowance[f][msg.sender]-=a; balanceOf[f]-=a; balanceOf[t]+= a - (a*feeBps/10000); return true; }
}
interface ICamp { function claim(uint256,string calldata,uint64,bytes calldata) external; }
contract Attacker {
    ICamp c; uint256 id; string s; uint256 public hits;
    constructor(address _c){ c=ICamp(_c); }
    function go(uint256 _id,string calldata _s) external { id=_id; s=_s; c.claim(_id,_s,0,""); }
    receive() external payable { hits++; try c.claim(id,s,0,"") {} catch {} }
}
