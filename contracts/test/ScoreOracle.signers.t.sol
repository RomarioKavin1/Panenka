// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ScoreOracle} from "../src/ScoreOracle.sol";
import {Errors} from "../src/libs/Errors.sol";

contract ScoreOracleSignersTest is Test {
    ScoreOracle oracle;
    address owner = address(0xA);
    address signer1 = address(0xB);
    address signer2 = address(0xC);
    address signer3 = address(0xD);
    address signer4 = address(0xE);
    address signer5 = address(0xF);
    address attacker = address(0x999);

    function setUp() public {
        address[] memory init = new address[](1);
        init[0] = signer1;
        vm.prank(owner);
        oracle = new ScoreOracle(init, 1);
    }

    function test_OwnerCanAddSigners() public {
        vm.prank(owner);
        oracle.setSigner(signer2, true);
        assertTrue(oracle.isSigner(signer2));
    }

    function test_NonOwnerCannotAddSigners() public {
        vm.expectRevert();
        vm.prank(attacker);
        oracle.setSigner(signer2, true);
    }

    function test_OwnerCanRotateThreshold() public {
        vm.prank(owner);
        oracle.setThreshold(3);
        assertEq(oracle.threshold(), 3);
    }

    function test_FinalizationRequiresThresholdVotes() public {
        // 3-of-3 setup: add signers 2, 3 and bump threshold
        vm.startPrank(owner);
        oracle.setSigner(signer2, true);
        oracle.setSigner(signer3, true);
        oracle.setThreshold(3);
        vm.stopPrank();

        bytes32 scoreR = keccak256("score-1");
        bytes32 dnpR = keccak256("dnp-1");

        // 1 vote — not finalized
        vm.prank(signer1);
        oracle.submitRoot(1, scoreR, dnpR);
        assertFalse(oracle.finalized(1));

        // 2 votes — still not finalized
        vm.prank(signer2);
        oracle.submitRoot(1, scoreR, dnpR);
        assertFalse(oracle.finalized(1));

        // 3 votes — finalized
        vm.prank(signer3);
        oracle.submitRoot(1, scoreR, dnpR);
        assertTrue(oracle.finalized(1));
        assertEq(oracle.roots(1), scoreR);
        assertEq(oracle.dnpRoots(1), dnpR);
    }

    function test_RemovedSignerCannotVote() public {
        vm.prank(owner);
        oracle.setSigner(signer1, false);

        vm.expectRevert(Errors.NotAuthorized.selector);
        vm.prank(signer1);
        oracle.submitRoot(1, keccak256("a"), keccak256("b"));
    }
}
